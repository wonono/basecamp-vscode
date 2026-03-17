// To-do list panel script
(function () {
  var todoPanel;
  var showCompleted = false;
  var peopleList = [];

  function init() {
    var app = document.getElementById("app");
    app.innerHTML = '<div class="todo-panel" id="todo-panel"><div class="loading">Loading to-dos...</div></div>';
    todoPanel = document.getElementById("todo-panel");

    window._onMessage("init", function (data) {
      renderTodos(data);
    });

    window._onMessage("todoUpdated", function () {
      // Already optimistically updated — just confirm
    });

    window._onMessage("todoCreated", function (data) {
      var activeSection = todoPanel.querySelector(".section-header");
      if (activeSection && activeSection.textContent.indexOf("All done") !== -1) {
        activeSection.textContent = "Active";
      }
      var html = createTodoHtml(data.todo);
      var div = document.createElement("div");
      div.innerHTML = html;
      var newItem = div.firstElementChild;
      var firstTodo = todoPanel.querySelector(".todo-item");
      if (firstTodo) {
        firstTodo.parentNode.insertBefore(newItem, firstTodo);
      } else if (activeSection) {
        activeSection.insertAdjacentElement("afterend", newItem);
      }
      bindTodoItem(newItem);
      // Clear form
      var input = document.getElementById("new-todo-input");
      var desc = document.getElementById("new-todo-desc");
      var dueInput = document.getElementById("new-todo-due");
      if (input) input.value = "";
      if (desc) { desc.value = ""; desc.style.display = "none"; }
      if (dueInput) dueInput.value = "";
      var toggle = document.getElementById("toggle-desc");
      if (toggle) toggle.textContent = "+ Add notes";
      var assignee = document.getElementById("new-todo-assignee");
      if (assignee) assignee.value = "";
    });

    window._onMessage("people", function (data) {
      peopleList = data.people;
      var select = document.getElementById("new-todo-assignee");
      if (select && peopleList.length > 0) {
        var opts = '<option value="">No assignee</option>';
        for (var p = 0; p < peopleList.length; p++) {
          opts += '<option value="' + peopleList[p].id + '">' + escapeHtml(peopleList[p].name) + '</option>';
        }
        select.innerHTML = opts;
        select.style.display = "block";
      }
    });

    window._onMessage("comments", function (data) {
      var container = document.getElementById("comments-" + data.todoId);
      if (!container) return;
      var html = "";
      for (var i = 0; i < data.comments.length; i++) {
        var c = data.comments[i];
        var date = new Date(c.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric" });
        html += '<div class="todo-comment">' +
          '<span class="todo-comment-author">' + escapeHtml(c.creator.name) + '</span>' +
          '<span class="todo-comment-date">' + date + '</span>' +
          '<div class="todo-comment-body">' + c.content + '</div>' +
          '</div>';
      }
      html += '<div class="todo-comment-form">' +
        '<input type="text" class="todo-comment-input" placeholder="Add a comment..." data-todo-id="' + data.todoId + '" />' +
        '</div>';
      container.innerHTML = html;
      container.style.display = "block";
      // Bind comment input
      var commentInput = container.querySelector(".todo-comment-input");
      if (commentInput) {
        commentInput.addEventListener("keydown", function (e) {
          if (e.key === "Enter") {
            var val = commentInput.value.trim();
            if (!val) return;
            window._postMessage("postTodoComment", { todoId: data.todoId, content: val });
            commentInput.value = "";
          }
        });
      }
    });

    window._onMessage("commentPosted", function (data) {
      var container = document.getElementById("comments-" + data.todoId);
      if (!container) return;
      var c = data.comment;
      var date = new Date(c.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric" });
      var html = '<div class="todo-comment">' +
        '<span class="todo-comment-author">' + escapeHtml(c.creator.name) + '</span>' +
        '<span class="todo-comment-date">' + date + '</span>' +
        '<div class="todo-comment-body">' + c.content + '</div>' +
        '</div>';
      var form = container.querySelector(".todo-comment-form");
      if (form) {
        form.insertAdjacentHTML("beforebegin", html);
      }
    });

    window._onMessage("error", function (data) {
      if (data.todoId) {
        revertTodo(data.todoId);
      }
      showError(data.message);
    });

    window._postMessage("ready");
    window._postMessage("loadPeople");
  }

  function renderTodos(data) {
    var html =
      '<div class="todo-header">' +
      "  <h1>" + escapeHtml(data.listName) + "</h1>" +
      '  <div class="todo-ratio">' + escapeHtml(data.completedRatio) + " completed</div>" +
      "</div>";

    // Add todo form
    html +=
      '<div class="add-todo-form">' +
      '  <div class="add-todo-row">' +
      '    <input type="text" id="new-todo-input" placeholder="Add a to-do..." />' +
      '    <button id="add-todo-btn">Add</button>' +
      '  </div>' +
      '  <div class="add-todo-options">' +
      '    <button class="toggle-desc-btn" id="toggle-desc">+ Add notes</button>' +
      '    <select id="new-todo-assignee" style="display:none"></select>' +
      '    <input type="date" id="new-todo-due" title="Due date" />' +
      '  </div>' +
      '  <textarea id="new-todo-desc" placeholder="Notes (optional)" style="display:none"></textarea>' +
      '</div>';

    // Active todos
    if (data.todos.length > 0) {
      html += '<div class="section-header">Active</div>';
      for (var i = 0; i < data.todos.length; i++) {
        html += createTodoHtml(data.todos[i]);
      }
    } else {
      html += '<div class="section-header">All done!</div>';
    }

    // Completed todos
    if (data.completedTodos.length > 0) {
      html +=
        '<div class="completed-section">' +
        '  <button class="completed-toggle" id="toggle-completed">' +
        "    Show " + data.completedTodos.length + " completed item(s)" +
        "  </button>" +
        '  <div id="completed-list" style="display:none">';

      for (var j = 0; j < data.completedTodos.length; j++) {
        html += createTodoHtml(data.completedTodos[j]);
      }

      html += "  </div></div>";
    }

    todoPanel.innerHTML = html;

    // Bind all todo items
    var items = todoPanel.querySelectorAll(".todo-item");
    for (var k = 0; k < items.length; k++) {
      bindTodoItem(items[k]);
    }

    // Bind add todo form
    var addBtn = document.getElementById("add-todo-btn");
    var newInput = document.getElementById("new-todo-input");
    var descInput = document.getElementById("new-todo-desc");
    var toggleDesc = document.getElementById("toggle-desc");

    if (addBtn && newInput) {
      addBtn.addEventListener("click", function () {
        submitNewTodo(newInput, descInput);
      });
      newInput.addEventListener("keydown", function (e) {
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          submitNewTodo(newInput, descInput);
        }
      });
    }
    if (toggleDesc && descInput) {
      toggleDesc.addEventListener("click", function () {
        var visible = descInput.style.display !== "none";
        descInput.style.display = visible ? "none" : "block";
        toggleDesc.textContent = visible ? "+ Add notes" : "- Hide notes";
        if (!visible) descInput.focus();
      });
    }

    // Bind completed toggle
    var toggleBtn = document.getElementById("toggle-completed");
    if (toggleBtn) {
      toggleBtn.addEventListener("click", function () {
        showCompleted = !showCompleted;
        var list = document.getElementById("completed-list");
        if (list) {
          list.style.display = showCompleted ? "block" : "none";
        }
        toggleBtn.textContent = showCompleted
          ? "Hide completed"
          : "Show " + data.completedTodos.length + " completed item(s)";
      });
    }

    // Re-populate assignee picker if people already loaded
    if (peopleList.length > 0) {
      var select = document.getElementById("new-todo-assignee");
      if (select) {
        var opts = '<option value="">No assignee</option>';
        for (var p = 0; p < peopleList.length; p++) {
          opts += '<option value="' + peopleList[p].id + '">' + escapeHtml(peopleList[p].name) + '</option>';
        }
        select.innerHTML = opts;
        select.style.display = "block";
      }
    }
  }

  function bindTodoItem(item) {
    var cb = item.querySelector('input[type="checkbox"]');
    if (cb) cb.addEventListener("change", onCheckboxChange);
    // Click on todo text to toggle comments
    var textEl = item.querySelector(".todo-text");
    if (textEl) {
      textEl.style.cursor = "pointer";
      textEl.addEventListener("click", function () {
        var todoId = parseInt(item.getAttribute("data-id"), 10);
        var commentsUrl = item.getAttribute("data-comments-url");
        var container = document.getElementById("comments-" + todoId);
        if (!container) return;
        if (container.style.display === "block") {
          container.style.display = "none";
          return;
        }
        if (commentsUrl) {
          container.innerHTML = '<div class="loading-sm">Loading comments...</div>';
          container.style.display = "block";
          window._postMessage("loadComments", { todoId: todoId, commentsUrl: commentsUrl });
        }
      });
    }
  }

  function createTodoHtml(todo) {
    var completedClass = todo.completed ? " completed" : "";
    var checked = todo.completed ? " checked" : "";
    var details = [];

    if (todo.assignees && todo.assignees.length > 0) {
      var names = todo.assignees.map(function (a) { return a.name; }).join(", ");
      details.push('<span class="todo-assignee">👤 ' + escapeHtml(names) + "</span>");
    }

    if (todo.due_on) {
      var isOverdue = new Date(todo.due_on) < new Date() && !todo.completed;
      var dueClass = isOverdue ? "todo-due overdue" : "todo-due";
      details.push('<span class="' + dueClass + '">📅 ' + todo.due_on + "</span>");
    }

    if (todo.comments_count > 0) {
      details.push('<span class="todo-comments-count">💬 ' + todo.comments_count + "</span>");
    }

    var detailsHtml = details.length > 0
      ? '<div class="todo-details">' + details.join("") + "</div>"
      : "";

    var notesHtml = todo.description
      ? '<div class="todo-notes">' + todo.description + "</div>"
      : "";

    var commentsUrl = todo.comments_url ? todo.comments_url : "";

    return (
      '<div class="todo-item' + completedClass + '" data-id="' + todo.id + '" data-comments-url="' + escapeHtml(commentsUrl) + '">' +
      '  <input type="checkbox"' + checked + ' data-id="' + todo.id + '">' +
      '  <div class="todo-content">' +
      '    <div class="todo-text">' + escapeHtml(todo.content) + "</div>" +
      notesHtml +
      detailsHtml +
      '    <div class="todo-comments-section" id="comments-' + todo.id + '" style="display:none"></div>' +
      "  </div>" +
      "</div>"
    );
  }

  function submitNewTodo(input, descInput) {
    var content = input.value.trim();
    if (!content) return;
    var description = descInput && descInput.value.trim() ? descInput.value.trim() : undefined;
    var assigneeSelect = document.getElementById("new-todo-assignee");
    var assigneeIds = [];
    if (assigneeSelect && assigneeSelect.value) {
      assigneeIds.push(parseInt(assigneeSelect.value, 10));
    }
    var dueInput = document.getElementById("new-todo-due");
    var dueOn = dueInput && dueInput.value ? dueInput.value : undefined;
    window._postMessage("createTodo", {
      content: content,
      description: description,
      assigneeIds: assigneeIds.length > 0 ? assigneeIds : undefined,
      dueOn: dueOn,
    });
  }

  function onCheckboxChange(e) {
    var checkbox = e.target;
    var todoId = parseInt(checkbox.getAttribute("data-id"), 10);
    var completed = checkbox.checked;

    var item = checkbox.closest(".todo-item");
    if (item) {
      if (completed) {
        item.classList.add("completed");
      } else {
        item.classList.remove("completed");
      }
    }

    window._postMessage("toggleTodo", { todoId: todoId, completed: completed });
  }

  function revertTodo(todoId) {
    var checkbox = todoPanel.querySelector('input[data-id="' + todoId + '"]');
    if (checkbox) {
      checkbox.checked = !checkbox.checked;
      var item = checkbox.closest(".todo-item");
      if (item) {
        item.classList.toggle("completed");
      }
    }
  }

  function escapeHtml(text) {
    if (!text) return "";
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
