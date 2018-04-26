# gitlab-dashboard

## Usage

Parameters in the query string:

- **gitlab**: your gitlab server address
- **token**: your gitlab token
- **projects**: a comma separated list of projects in the form GROUP_NAME/PROJECT_NAME/BRANCH_NAME you want to monitor.
- **jobs_per_line**: number of columns per row (default value is 10)

At least one `projects` need to be set.

Example:

```
http://gitlab-ci-monitor.example.com/?gitlab=gitlab.example.com&token=12345&projects=namespace/project1/master,namespace/project1/branch1,namespace/project2/master
```

Inspired by [globocom/gitlab-ci-monitor](https://github.com/globocom/gitlab-ci-monitor)
