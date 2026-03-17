// To-do list panel script
(function () {
  var todoPanel;
  var showCompleted = false;

  function init() {
    var app = document.getElementById("app");
    app.innerHTML = '<div class="todo-panel" id="todo-panel"><div class="loading">Loading to-dos...</div></div>';
    todoPanel = document.getElementById("todo-panel");

    window._onMessage("init", function (data) {
      renderTodos(data);
    });

    window._onMessage("todoUpdated", function (data) {
      // Already optimistically updated — just confirm
    });

    window._onMessage("todoCreated", function (data) {
      // Insert the new todo at the top of the active list
      var activeSection = todoPanel.querySelector(".section-header");
      if (activeSection && activeSection.textContent.indexOf("All done") !== -1) {
        activeSection.textContent = "Active";
      }
      var html = createTodoHtml(data.todo);
      var div = document.createElement("div");
      div.innerHTML = html;
      var newItem = div.firstElementChild;
      // Insert after the "Active" section header
      var firstTodo = todoPanel.querySelector(".todo-item");
      if (firstTodo) {
        firstTodo.parentNode.insertBefore(newItem, firstTodo);
      } else if (activeSection) {
        activeSection.insertAdjacentElement("afterend", newItem);
      }
      // Bind checkbox
      var cb = newItem.querySelector('input[type="checkbox"]');
      if (cb) cb.addEventListener("change", onCheckboxChange);
      // Clear form
      var input = document.getElementById("new-todo-input");
      var desc = document.getElementById("new-todo-desc");
      if (input) input.value = "";
      if (desc) { desc.value = ""; desc.style.display = "none"; }
      var toggle = document.getElementById("toggle-desc");
      if (toggle) toggle.textContent = "+ Add notes";
    });

    window._onMessage("error", function (data) {
      if (data.todoId) {
        revertTodo(data.todoId);
      }
      showError(data.message);
    });

    window._postMessage("ready");
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
      '  <button class="toggle-desc-btn" id="toggle-desc">+ Add notes</button>' +
      '  <textarea id="new-todo-desc" placeholder="Notes (optional)" style="display:none"></textarea>' +
      '</div>';

    // Active todos
    if (data.todos.length > 0) {
      html += '<div class="section-header">Active</div>';
      for (var i = 0; i < data.todos.length; i++) {
        html += createTodoHtml(data.todos[i]);
      }
    } else {
      html += '<div class="section-header">All done! 🎉</div>';
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

    // Bind checkbox events
    var checkboxes = todoPanel.querySelectorAll('input[type="checkbox"]');
    for (var k = 0; k < checkboxes.length; k++) {
      checkboxes[k].addEventListener("change", onCheckboxChange);
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

    var detailsHtml = details.length > 0
      ? '<div class="todo-details">' + details.join("") + "</div>"
      : "";

    var notesHtml = todo.description
      ? '<div class="todo-notes">' + todo.description + "</div>"
      : "";

    return (
      '<div class="todo-item' + completedClass + '" data-id="' + todo.id + '">' +
      '  <input type="checkbox"' + checked + ' data-id="' + todo.id + '">' +
      '  <div class="todo-content">' +
      '    <div class="todo-text">' + escapeHtml(todo.content) + "</div>" +
      notesHtml +
      detailsHtml +
      "  </div>" +
      "</div>"
    );
  }

  function submitNewTodo(input, descInput) {
    var content = input.value.trim();
    if (!content) return;
    var description = descInput && descInput.value.trim() ? descInput.value.trim() : undefined;
    window._postMessage("createTodo", { content: content, description: description });
  }

  function onCheckboxChange(e) {
    var checkbox = e.target;
    var todoId = parseInt(checkbox.getAttribute("data-id"), 10);
    var completed = checkbox.checked;

    // Optimistic UI update
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
