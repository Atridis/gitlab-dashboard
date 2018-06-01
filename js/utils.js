
function getParameterByName(name, url) {
  if (!url) url = window.location.href;
  name = name.replace(/[\[\]]/g, "\\$&");
  var regex = new RegExp("[?&]" + name + "(=([^&#]*)|&|#|$)"),
      results = regex.exec(url);
  if (!results) return null;
  if (!results[2]) return '';
  // / and %2F problem
  //return decodeURIComponent(results[2].replace(/\+/g, " "));
  return results[2].replace(/\+/g, " ");
}
