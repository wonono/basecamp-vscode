// Message thread panel script
(function () {
  var threadContainer;
  var commentTextarea;

  function init() {
    var app = document.getElementById("app");
    app.innerHTML = '<div class="message-thread" id="thread"><div class="loading">Loading message...</div></div>';
    threadContainer = document.getElementById("thread");

    window._onMessage("init", function (data) {
      renderThread(data.message, data.comments);
    });

    window._onMessage("commentPosted", function (data) {
      appendComment(data.comment);
      if (commentTextarea) {
        commentTextarea.value = "";
      }
    });

    window._onMessage("error", function (data) {
      showError(data.message);
    });

    // Intercept link clicks
    document.addEventListener("click", function (e) {
      var link = e.target.closest("a[data-external]");
      if (link) {
        e.preventDefault();
        var href = link.getAttribute("href");
        if (href) {
          window._postMessage("openExternal", { url: href });
        }
      }
    });

    window._postMessage("ready");
  }

  function renderThread(message, comments) {
    var date = new Date(message.created_at).toLocaleDateString(undefined, {
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    var initials = getInitials(message.creator.name);

    var html =
      '<div class="message-header">' +
      "  <h1>" + escapeHtml(message.subject) + "</h1>" +
      '  <div class="message-meta">' +
      '    <span class="avatar">' + initials + "</span>" +
      "    <span>" + escapeHtml(message.creator.name) + "</span>" +
      '    <span class="meta">' + date + "</span>" +
      "  </div>" +
      "</div>" +
      '<div class="message-body">' + message.content + "</div>";

    // Comments section
    html +=
      '<div class="comments-section">' +
      '  <div class="comments-header">Comments (' + comments.length + ")</div>" +
      '  <div id="comments-list">';

    for (var i = 0; i < comments.length; i++) {
      html += createCommentHtml(comments[i]);
    }

    html += "</div>";

    // Comment form
    html +=
      '<div class="comment-form">' +
      '  <textarea id="comment-input" placeholder="Write a comment..."></textarea>' +
      '  <div class="comment-form-actions">' +
      '    <button id="post-comment-btn">Post Comment</button>' +
      "  </div>" +
      "</div>" +
      "</div>";

    threadContainer.innerHTML = html;

    commentTextarea = document.getElementById("comment-input");
    var postBtn = document.getElementById("post-comment-btn");
    postBtn.addEventListener("click", postComment);
  }

  function createCommentHtml(comment) {
    var date = new Date(comment.created_at).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
    var initials = getInitials(comment.creator.name);

    return (
      '<div class="comment" data-id="' + comment.id + '">' +
      '  <div class="comment-meta">' +
      '    <span class="avatar">' + initials + "</span>" +
      '    <span class="comment-author">' + escapeHtml(comment.creator.name) + "</span>" +
      '    <span class="comment-date">' + date + "</span>" +
      "  </div>" +
      '  <div class="comment-body">' + comment.content + "</div>" +
      "</div>"
    );
  }

  function appendComment(comment) {
    var list = document.getElementById("comments-list");
    if (list) {
      var div = document.createElement("div");
      div.innerHTML = createCommentHtml(comment);
      list.appendChild(div.firstElementChild);
    }
    // Update count
    var header = document.querySelector(".comments-header");
    if (header) {
      var count = document.querySelectorAll(".comment").length;
      header.textContent = "Comments (" + count + ")";
    }
  }

  function postComment() {
    if (!commentTextarea) return;
    var content = commentTextarea.value.trim();
    if (!content) return;
    window._postMessage("postComment", { content: content });
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
