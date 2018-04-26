const onError = function (error) {
    if (error.message === undefined) {
        if (error.response && error.response.status === 401) {
            this.onError = { message: "Unauthorized Access. Please check your token." }
        } else {
            this.onError = { message: "Something went wrong. Make sure the configuration is ok and your Gitlab is up and running."}
        }
    } else {
        this.onError = { message: error.message }
    }
    console.log(this.onError.message)
}
  
Vue.directive('dropdown', {
  inserted(el) {
      $(el).dropdown()
  }
})

const app = new Vue({
    el: '#app',
    data: {
        project_pipeline_keys: {},
        project_pipelines: [],
        projects: {},
        pipelines: [],
        pipelinesMap: {},
        pipelineJobs: {},
        token: null,
        gitlab: null,
        jobs_per_line: 10,
        repositories: null,
        loading: false,
        invalidConfig: false,
        onError: null,
        some_array: [],
        superflag: false
    },
    created: function() {
        this.loadConfig()

        const error = this.validateConfig()
        if (error !== undefined) {
          onError.bind(this)(error)
          return
        }

        this.setupDefaults()
        this.fetchProjects()

    },
    methods: {
        say: function (pipelineId) {
          const self = this
          const b = self.pipelinesMap[pipelineId]

          if (b !== undefined) {
            b.loading_jobs = true
          } 

          this.updateJobsInfo(pipelineId)

        },
        statusIcon: function(pipeline) {
          if (pipeline.status == 'running') {
            return 'large blue loading spinner'
          }
          else if (pipeline.status == 'pending') {
            return 'large blue loading spinner'
          }
          else if (pipeline.status == 'success') {
            return 'large green check circle outline'
          }
          else if (pipeline.status == 'failed') {
            return 'large red exclamation circle'
          }
          else if (pipeline.status == 'canceled') {
            return 'large grey ban'
          }
          else if (pipeline.status == 'skipped') {
            return 'large grey angle double right'
          }
          else {
            return 'large question circle outline'
          }
        },
        loadConfig: function() {
            const self = this
            self.gitlab = getParameterByName("gitlab")
            self.token = getParameterByName("token")
            self.ref = getParameterByName("ref")
            self.jobs_per_line = getParameterByName("jobs_per_line")
            self.repositories = []

            const repositoriesParameter = getParameterByName("projects")
            if (repositoriesParameter != null) {
              const uniqueRepos = {}
              let repositories = repositoriesParameter.split(",").forEach(function(repo) {
                uniqueRepos[repo.trim()] = true
              })
              repositories = Object.keys(uniqueRepos)
              for (const x in repositories) {
                try {
                  const repository = repositories[x].split('/')
                  let branch, projectName, nameWithNamespace
                  if (repository.length < 3) {
                    branch = ""
                    projectName = repository[repository.length - 1].trim()
                    nameWithNamespace = repository.join('/')
                  } else {
                    branch = repository[repository.length - 1].trim()
                    projectName = repository[repository.length - 2].trim()
                    nameWithNamespace = repository.slice(0, repository.length - 1).join('/')
                  }
                  self.repositories.push({
                    nameWithNamespace: nameWithNamespace,
                    projectName: projectName,
                    branch: branch,
                    key: nameWithNamespace + '/' + branch
                  })
                } catch (err) {
                  onError.bind(self)({ message: "Wrong projects format! Try: 'namespace/project/branch'", response: { status: 500 } })
                }
              }
            }
            const groupsParameter = getParameterByName("groups")
            if (groupsParameter != null) {
              self.groups = groupsParameter.split(",")
            }
        },
        validateConfig: function() {
            const error = { response: { status: 500 } }
            if (this.repositories.length === 0 && this.groups.length === 0) {
              error.message = "You need to set projects or groups"
              return error
            } else if (this.repositories === null || this.token === null || this.gitlab === null && this.token !== "use_cookie") {
              error.message = "Wrong format"
              return error
            }
          },
        setupDefaults: function() {
            if (this.token !== "use_cookie") {
              axios.defaults.baseURL = "https://" + this.gitlab + "/api/v4"
              axios.defaults.headers.common['PRIVATE-TOKEN'] = this.token
            } else {
              // Running on the GitLab-Server...
              axios.defaults.baseURL = "/api/v4"
              this.gitlab = location.hostname
            }
        },
        fetchProjects: function() {
            const self = this
            self.repositories.forEach(function(repository) {
              self.loading = true
              axios.get('/projects/' + repository.nameWithNamespace.replace('/', '%2F'))
                .then(function (response) {
                  self.loading = false
                  if (repository.branch === "") {
                    repository.branch = response.data.default_branch
                  }
                  const project = { project: repository, data: response.data }
                  if (self.projects[repository.nameWithNamespace + '/' + repository.branch] === undefined) {
                    self.projects[repository.nameWithNamespace + '/' + repository.branch] = project
                    self.fetchBuild(project)                   
                  }
                })
                .catch(onError.bind(self))
            })
        },
        fetchBuild: function(p) {
            const self = this
            this.jobs_per_line
            axios.get('/projects/' + p.data.id + '/pipelines/?ref=' + p.project.branch + '&per_page=' + this.jobs_per_line)
              .then(function(pipelines) {
                if (pipelines.data.length === 0) {
                  return
                }
                for (i = 0; i < pipelines.data.length; i++) {
                    const commitId = pipelines.data[i].sha
                    const pipelineId = pipelines.data[i].id
                    axios.get('/projects/' + p.data.id + '/repository/commits/' + commitId)
                    .then(function(commit) {
                        self.updateBuildInfo(p, commit, pipelineId)
                    })
                    .catch(onError.bind(self))
                }
              })
              .catch(onError.bind(self))
        },
        updateBuilds: function() {
            const self = this
            self.onError = null
            Object.values(self.projects).forEach(function(p) { self.fetchBuild(p) })
            self.pipelines.sort(function(a, b) { return a.project.localeCompare(b.project) })
        },
        updateBuildInfo: function(p, commit, pipelineId) {
            const self = this
            axios.get('/projects/' + p.data.id + '/pipelines/' + pipelineId)
              .then(function(pipeline) {
                const startedAt = pipeline.data.started_at
                const startedFromNow = moment(startedAt).fromNow()
                const b = self.pipelinesMap[pipelineId]

                if (b !== undefined) {
                  b.id = pipeline.data.id
                  b.status = pipeline.data.status
                  b.started_from_now = startedFromNow
                  b.started_at = startedAt
                  b.author = commit.data.author_name
                  b.title = commit.data.title
                  b.sha1 = commit.data.id
                  b.short_sha1 = commit.data.short_id
                } 
                else {
                  const project = {
                    project: p.project.projectName,
                    id: pipeline.data.id,
                    status: pipeline.data.status,
                    started_from_now: startedFromNow,
                    started_at: startedAt,
                    author: commit.data.author_name,
                    project_path: p.project.nameWithNamespace,
                    branch: p.project.branch,
                    title: commit.data.title,
                    sha1: commit.data.id,
                    short_sha1: commit.data.short_id,
                    stages: {},
                    loading_jobs: false
                  }

                  const project_pipeline_key = p.project.nameWithNamespace + '/' + p.project.branch                 
                  if (self.project_pipeline_keys[project_pipeline_key] == undefined) {                   
                    const new_index = self.project_pipelines.push([]) - 1
                    Vue.set(self.project_pipeline_keys, project_pipeline_key, new_index)
                  }

                  index = self.project_pipeline_keys[project_pipeline_key]
                  self.project_pipelines[index].push(project)
                  self.pipelines.push(project)
                  self.project_pipelines[index].sort(function(a, b){return new Date(b.started_at) - new Date(a.started_at);})

                  Vue.set(self.pipelinesMap, pipelineId, project)
                }
              })
              .catch(onError.bind(self))
        },
        updateJobsInfo: function(pipelineId) {

          const self = this
          const b = self.pipelinesMap[pipelineId]

          if (Object.keys(b.stages).length > 0){
            
            b.loading_jobs = false
            return
          }

          axios.get('/projects/' + b.project_path.replace('/', '%2F') + '/pipelines/' + pipelineId + '/jobs')
            .then(function(jobs) {
              const b = self.pipelinesMap[pipelineId]             
              if (b !== undefined) {

                if (jobs.data.length === 0) {
                  b.loading_jobs = false
                  return
                }                
                for (i = 0; i < jobs.data.length; i++) {

                  stageName = jobs.data[i].stage
                  const stg = b.stages[stageName]

                  if (stg == undefined) {
                    b.stages[stageName] = {jobs: []}
                  }

                  b.stages[stageName].jobs.push({
                    name: jobs.data[i].name,
                    id: jobs.data[i].id,
                    link: "https://" + self.gitlab + '/' + b.project_path + '/-/jobs/' + jobs.data[i].id
                  })
                }
                b.loading_jobs = false
              } 
            })
            .catch(onError.bind(self))
        }        
    }
})
