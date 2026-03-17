// Singleton wrapper for acquireVsCodeApi() — must only be called ONCE
(function () {
  const vscode = acquireVsCodeApi();
  window._vscode = vscode;

  window._postMessage = function (type, data) {
    vscode.postMessage({ type: type, data: data });
  };

  window._onMessage = function (type, handler) {
    window.addEventListener("message", function (event) {
      var msg = event.data;
      if (msg.type === type) {
        handler(msg.data);
      }
    });
  };

  window._saveState = function (state) {
    vscode.setState(state);
  };

  window._getState = function () {
    return vscode.getState() || {};
  };
})();
