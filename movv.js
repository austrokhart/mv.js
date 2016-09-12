/**
 * Created by Brian on 02.09.2016.
 */
function Movv(options) {
  this._options = {
    selector: this._methods.choose(options.selector, this._defaults.options.selector),
    mode: this._methods.choose(options.mode, this._defaults.options.mode),
    backAtOut: this._methods.choose(options.backAtOut, this._defaults.options.backAtOut),
    afterTake: this._methods.choose(options.afterTake, this._defaults.options.afterTake),
    afterMove: this._methods.choose(options.afterMove, this._defaults.options.afterMove),
    afterDrop: this._methods.choose(options.afterDrop, this._defaults.options.afterDrop)
  };

  this._state = 0;
  this._order = 0;

  this._data = {
    target: {},
    cursorOffset: {},
    elementList: {},
    elementBounds: {},
    initialPosition: null,
    lastPosition: null
  };

  this._handlers = {
    mouseDown: function(e) {
      if (this._state == 0 && this._methods.matches(e.target, this._options.selector)) {
        /* смещение курсора, границы элементов, позиция целевого элемента */
        var targetBounds = e.target.getBoundingClientRect();
        var cursorOffset = {
          top:  e.clientY - targetBounds.top,
          left: e.clientX - targetBounds.left
        };

        var elementList = this._methods.getElements.bind(this)(document.querySelectorAll(this._options.selector));

        var elementBounds = [];
          for (var i = 0; i < elementList.length; i++) {
            if (elementList[i] == e.target) {
              var initialPosition = i;
            }

            elementBounds[i] = this._methods.getOffset(elementList[i]);
          }

        this._data = {
          target: e.target,
          cursorOffset: cursorOffset,
          elementList: elementList,
          elementBounds: elementBounds,
          initialPosition: initialPosition,
          lastPosition: initialPosition
        };

        e.preventDefault();

        this._methods.setStyle(e.target, {
          position: 'absolute',
          top: elementBounds[initialPosition].top + 'px', /* top/left на случай установленных значений */
          left: elementBounds[initialPosition].left + 'px',
          margin: '0'
        });

        this._methods.form.insert.bind(this)(e.target);

        this._methods.renumber.bind(this)(elementList);

        document.documentElement.addEventListener('mousemove', this._handlers.mouseMove);
        document.documentElement.addEventListener('mouseup', this._handlers.mouseUp);

        this._state = 1;
        this._options.afterTake.bind(this)();
      }
    }.bind(this),

    mouseMove: function(e) {
      var cursorMove = {
        top: window.pageYOffset + e.clientY,
        left: window.pageXOffset + e.clientX
      };

      this._methods.setStyle(this._data.target, {
        top: cursorMove.top - this._data.cursorOffset.top + 'px',
        left: cursorMove.left - this._data.cursorOffset.left + 'px'
      });

      var crossed = false; /* вычисление пересечения */
        for (var i = 0; i < this._data.elementBounds.length; i++) {
          if (cursorMove.top >= this._data.elementBounds[i].top && cursorMove.top <= this._data.elementBounds[i].bottom
            && cursorMove.left >= this._data.elementBounds[i].left && cursorMove.left <= this._data.elementBounds[i].right) {

            crossed = true; break;
          }
        }

      if (this._options.backAtOut && !crossed) { /* для backAtOut = true */
        i = this._data.initialPosition;
      }

      if (this._options.backAtOut || crossed) {
        if (i != this._data.lastPosition) {
          if (this._options.mode == this._defaults.names.replaceMode) {
            /* возвращаем элементы на свои места, обмениваем с новым */
            this._methods.swap(this._data.elementList, this._data.lastPosition, this._data.initialPosition);
            this._methods.swap(this._data.elementList, this._data.initialPosition, i);
          }
          else
          if (this._options.mode == this._defaults.names.shiftMode) {
            /* поочерёдно обмениваем элементы до новой позиции */
            var j = this._data.lastPosition;

            if (i > j) {
              for (; j < i; j++) {
                this._methods.swap(this._data.elementList, j, j + 1);
              }
            }
            else {
              for (; j > i; j--) {
                this._methods.swap(this._data.elementList, j, j - 1);
              }
            }
          }

          this._methods.form.move.bind(this)(this._data.elementList[this._data.lastPosition], this._data.elementList[i]);

          this._data.lastPosition = i;

          this._options.afterMove.bind(this)();
        }
      }
    }.bind(this),

    mouseUp: function() {
      this._methods.setStyle(this._data.target, {
        position: null,
        top: null,
        left: null,
        margin: null
      });

      this._methods.form.remove.bind(this)(this._data.target);

      document.documentElement.removeEventListener('mousemove', this._handlers.mouseMove);
      document.documentElement.removeEventListener('mouseup', this._handlers.mouseUp);

      this._data = {};
      this._state = 0;

      this._options.afterDrop.bind(this)();
    }.bind(this)
  };

  return this;
}

Movv.prototype._defaults = {
  names: {
    replaceMode: 'replace',
    shiftMode: 'shift',
    class: 'form',
    attribute: 'data-movv'
  },
  get options() {
    return {
      selector: '',
      mode: this.names.shiftMode,
      backAtOut: false,
      afterTake: function() {},
      afterMove: function() {},
      afterDrop: function() {}
    };
  }
};

Movv.prototype._methods = {
  /* для выбора назначенного значения, используется для установки умолчаний */
  choose: function() {
    for (var i = 0; i < arguments.length; i++) {
      if (typeof arguments[i] != 'undefined') {
        break;
      }
    }

    return arguments[i]; /* для пустого множества аргументов вернёт undefined */
  },

  getElements: function(elementList) {
    return [].filter.call(elementList, function(element) {
      return !element.classList.contains(this._defaults.names.class);
    }.bind(this));
  },

  /* для нумерации элементов, используется при инициализации, при нажатии мыши, при получении и установке порядка */
  renumber: function(elementList) {
    for (var i = 0; i < elementList.length; i++) {
      if (!elementList[i].getAttribute(this._defaults.names.attribute)) {
        elementList[i].setAttribute(this._defaults.names.attribute, this._order.toString());
        this._order++;
      }
    }
  },

  /* для вычисления совпадения селектора, используется при назначении слушателя на каждый элемент страницы */
  matches: function(node, selector) {
    return (
      Element.prototype.matches ||
      Element.prototype.msMatchesSelector ||
      Element.prototype.webkitMatchesSelector
    ).bind(node, selector)();
  },

  /* для получения смещения элемента относительно начала документа, используется для вычисления вхождения курсора в пределы элемента */
  getOffset: function(element) {
    var elementBounds = element.getBoundingClientRect();

    return {
      top: window.pageYOffset + elementBounds.top, right: window.pageXOffset + elementBounds.right,
      bottom: window.pageYOffset + elementBounds.bottom, left: window.pageXOffset + elementBounds.left
    };
  },

  /* для установки стиля */
  setStyle: function(element, properties) {
    for (var p in properties) {
      if (properties.hasOwnProperty(p)) {
        element.style[p] = properties[p];
      }
    }
  },

  /* для работы с формами */
  form: {
    insert: function(element) {
      var form = document.createElement(element.tagName);

      form.className = element.className;
      form.classList.add(this._defaults.names.class);

      element.parentNode.insertBefore(form, element.nextSibling);
    },

    move: function(firstElement, lastElement) {
      if (firstElement.nextSibling.classList.contains(this._defaults.names.class)) {
        lastElement.parentNode.insertBefore(firstElement.nextSibling, lastElement.nextSibling);
      }
    },

    remove: function(element) {
      if (element.nextSibling.classList.contains(this._defaults.names.class)) {
        element.parentNode.removeChild(element.nextSibling);
      }
    }
  },

  /* для вставки формы */
  insertForm: function(element) {
    var form = document.createElement(element.tagName);

    form.className = element.className;
    form.classList.add(this._defaults.names.class);

    element.parentNode.insertBefore(form, element.nextSibling);
  },

  /* для перемещения формы */
  moveForm: function(firstElement, lastElement) {
    if (firstElement.nextSibling.classList.contains(this._defaults.names.class)) {
      lastElement.parentNode.insertBefore(firstElement.nextSibling, lastElement.nextSibling);
    }
  },

  /* для удаления формы */
  removeForm: function(element) {
    if (element.nextSibling.classList.contains(this._defaults.names.class)) {
      element.parentNode.removeChild(element.nextSibling);
    }
  },

  /* для обмена элементов с обновлением списка */
  swap: function(elementList, firstElement, lastElement) {
    if (elementList[firstElement] != elementList[lastElement]) {
      var firstNodeData = {
        parentNode: elementList[firstElement].parentNode,
        nextSibling: elementList[firstElement].nextSibling
      };

      firstNodeData.parentNode.insertBefore(elementList[lastElement].parentNode.replaceChild(
        elementList[firstElement], elementList[lastElement]), firstNodeData.nextSibling);

      var t = elementList[lastElement];

      elementList[lastElement] = elementList[firstElement];
      elementList[firstElement] = t;
    }
  }
};

/* инициализация */
Movv.prototype.init = function() {
  this._methods.renumber.bind(this)(this._methods.getElements.bind(this)(document.querySelectorAll(this._options.selector)));
  document.documentElement.addEventListener('mousedown', this._handlers.mouseDown);

  return this;
};

/* терминация, сохраняет порядок */
Movv.prototype.term = function() {
  document.documentElement.removeEventListener('mousedown', this._handlers.mouseDown);

  return this;
};

/* возвращает порядок элементов */
Movv.prototype.getOrder = function() {
  var elementList = this._methods.getElements.bind(this)(document.querySelectorAll(this._options.selector));

  this._methods.renumber.bind(this)(elementList);

  return elementList.map(function(element) {
    return element.getAttribute(this._defaults.names.attribute);
  }.bind(this));
};

/* устанавливает порядок элементов */
Movv.prototype.setOrder = function(order) {
  var elementList = this._methods.getElements.bind(this)(document.querySelectorAll(this._options.selector));

  this._methods.renumber.bind(this)(elementList);

  for (var i = 0; i < elementList.length; i++) {
    for (var j = i; j < elementList.length; j++) {
      if (elementList[j].getAttribute(this._defaults.names.attribute) == order[i]) {
        this._methods.swap(elementList, i, j); break;
      }
    }
  }

  return this;
};

/* возвращает значение опции */
Movv.prototype.getOption = function(name) {
  return this._options[name];
};

/* устанавливает значение опции */
Movv.prototype.setOption = function(name, value) {
  this._options[name] = value;

  return this;
};