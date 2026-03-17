// Campfire chat panel script
(function () {
  var messagesContainer;
  var textarea;
  var sendBtn;
  var knownIds = {};
  var clientIdCounter = 0;

  function init() {
    var app = document.getElementById("app");
    app.innerHTML =
      '<div class="messages" id="messages"><div class="loading">Loading messages...</div></div>' +
      '<div class="input-area">' +
      '  <textarea id="input" placeholder="Type a message..." rows="1"></textarea>' +
      '  <button id="send-btn">Send</button>' +
      "</div>";

    messagesContainer = document.getElementById("messages");
    textarea = document.getElementById("input");
    sendBtn = document.getElementById("send-btn");

    // Restore draft
    var state = window._getState();
    if (state.draft) {
      textarea.value = state.draft;
    }

    // Send on Enter (Shift+Enter for newline)
    textarea.addEventListener("keydown", function (e) {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    });

    // Save draft on input
    textarea.addEventListener("input", function () {
      window._saveState({ draft: textarea.value });
    });

    sendBtn.addEventListener("click", sendMessage);

    // Listen for messages from extension
    window._onMessage("init", function (data) {
      renderInitialLines(data.lines);
    });

    window._onMessage("newLines", function (data) {
      appendLines(data.lines);
    });

    window._onMessage("lineSent", function (data) {
      // Replace pending message with confirmed one
      var pending = document.getElementById("pending-" + data.clientId);
      if (pending) {
        pending.remove();
      }
      appendLines([data.line]);
    });

    window._onMessage("error", function (data) {
      showError(data.message);
    });

    // Tell extension we're ready
    window._postMessage("ready");
  }

  function sendMessage() {
    var content = textarea.value.trim();
    if (!content) return;

    var clientId = "c" + ++clientIdCounter;
    textarea.value = "";
    window._saveState({ draft: "" });

    // Optimistic: show pending message
    var html = createMessageHtml({
      id: clientId,
      creator: { name: "You" },
      content: content,
      created_at: new Date().toISOString(),
    });
    var div = document.createElement("div");
    div.innerHTML = html;
    var el = div.firstElementChild;
    el.id = "pending-" + clientId;
    el.classList.add("message-pending");
    messagesContainer.appendChild(el);
    scrollToBottom();

    window._postMessage("sendLine", { content: content, clientId: clientId });
  }

  function renderInitialLines(lines) {
    messagesContainer.innerHTML = "";
    if (lines.length === 0) {
      messagesContainer.innerHTML = '<div class="empty-state">No messages yet. Start the conversation!</div>';
      return;
    }
    for (var i = 0; i < lines.length; i++) {
      appendSingleLine(lines[i]);
    }
    scrollToBottom();
  }

  function appendLines(lines) {
    var isAtBottom = checkAtBottom();
    for (var i = 0; i < lines.length; i++) {
      appendSingleLine(lines[i]);
    }
    if (isAtBottom) {
      scrollToBottom();
    }
  }

  function appendSingleLine(line) {
    if (knownIds[line.id]) return;
    knownIds[line.id] = true;

    var html = createMessageHtml(line);
    var div = document.createElement("div");
    div.innerHTML = html;
    messagesContainer.appendChild(div.firstElementChild);
  }

  function createMessageHtml(line) {
    var date = new Date(line.created_at);
    var time = date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    var initials = getInitials(line.creator.name);
    var content = escapeHtml(line.content);

    return (
      '<div class="message" data-id="' + line.id + '">' +
      '  <div class="avatar">' + initials + "</div>" +
      '  <div class="message-body">' +
      '    <div class="message-header">' +
      '      <span class="message-author">' + escapeHtml(line.creator.name) + "</span>" +
      '      <span class="message-time">' + time + "</span>" +
      "    </div>" +
      '    <div class="message-content">' + content + "</div>" +
      "  </div>" +
      "</div>"
    );
  }

  function checkAtBottom() {
    var threshold = 50;
    return (
      messagesContainer.scrollHeight -
        messagesContainer.scrollTop -
        messagesContainer.clientHeight <
      threshold
    );
  }

  function scrollToBottom() {
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }

  function getInitials(name) {
    var parts = name.split(" ");
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  }

  function escapeHtml(text) {
    var div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }

  function showError(message) {
    var toast = document.createElement("div");
    toast.className = "error-toast";
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(function () {
      toast.remove();
    }, 5000);
  }

  init();
})();
