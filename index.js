const document = require('global/document')
const sendAction = require('send-action')
const mutate = require('xtend/mutable')
const assert = require('assert')
const xtend = require('xtend')

module.exports = store

// framework for creating sturdy web applications
// obj -> fn
function store (_handlers) {
  var reducersCalled = false
  var effectsCalled = false
  var stateCalled = false
  var subsCalled = false
  var send = null
  const handlers = Object.assign({
    onError: (err) => {
      if (err) console.error(err)
    },
    onAction: () => {},
    onState: () => {}
  }, _handlers || {})

  ;['onError', 'onAction', 'onState'].forEach((handler) => {
    if (typeof handlers[handler] !== 'function') {
      console.warn(`${handler} passed to store is not a function`)
    }
  })

  const _models = []

  start.model = model
  start.start = start
  start.state = getState

  return start

  // create a new model
  // (obj) -> null
  function model (model) {
    _models.push(model)
  }

  // get the current application state
  // (obj) -> obj
  function getState (opts) {
    opts = opts || {}
    if (send === null) {
      console.warn('must call store.start() before store.state()')
      return {}
    }
    if (opts.noFreeze) return xtend(send.state())
    else return Object.freeze(xtend(send.state()))
  }

  // start the application
  // (obj?) -> fn
  function start (opts) {
    opts = opts || {}
    const initialState = {}
    const reducers = {}
    const effects = {}

    _models.forEach(function (model) {
      if (!stateCalled && model.state && !opts.noState) {
        apply(model.namespace, model.state, initialState)
      }
      if (!reducersCalled && model.reducers && !opts.noReducers) {
        apply(model.namespace, model.reducers, reducers)
      }
      if (!effectsCalled && model.effects && !opts.noEffects) {
        apply(model.namespace, model.effects, effects)
      }
    })

    if (!opts.noState) stateCalled = true
    if (!opts.noReducers) reducersCalled = true
    if (!opts.noEffects) effectsCalled = true

    // send() is used to trigger actions inside
    // effects and subscriptions
    send = sendAction({
      onaction: handleAction,
      onchange: onchange,
      state: initialState
    })

    // subscriptions are loaded after sendAction() is called
    // because they both need access to send() and can't
    // react to actions (read-only) - also wait on DOM to
    // be loaded
    document.addEventListener('DOMContentLoaded', function () {
      _models.forEach(function (model) {
        if (!subsCalled && model.subscriptions && !opts.noSubscriptions) {
          assert.ok(Array.isArray(model.subscriptions), 'subs must be an arr')
          model.subscriptions.forEach(function (sub) {
            sub(send)
          })
        }
      })
      if (!opts.noSubscriptions) {
        subsCalled = true
      }
    })

    return send

    // handle an action by either reducers, effects
    // or both - return the new state when done
    // (obj, obj, fn) -> obj
    function handleAction (action, state, send) {
      var reducersCalled = false
      var effectsCalled = false
      const newState = xtend(state)

      handlers.onAction(action, state, action.type, send)

      // validate if a namespace exists. Namespaces
      // are delimited by the first ':'. Perhaps
      // we'll allow recursive namespaces in the
      // future - who knows
      if (/:/.test(action.type)) {
        const arr = action.type.split(':')
        var ns = arr.shift()
        action.type = arr.join(':')
      }

      const _reducers = ns ? reducers[ns] : reducers
      if (_reducers && _reducers[action.type]) {
        if (ns) {
          const reducedState = _reducers[action.type](action, state[ns])
          if (!newState[ns]) newState[ns] = {}
          mutate(newState[ns], xtend(state[ns], reducedState))
        } else {
          mutate(newState, reducers[action.type](action, state))
        }
        reducersCalled = true
      }

      const _effects = ns ? effects[ns] : effects
      if (_effects && _effects[action.type]) {
        if (ns) _effects[action.type](action, state[ns], send)
        else _effects[action.type](action, state, send)
        effectsCalled = true
      }

      if (!reducersCalled && !effectsCalled) {
        handlers.onError(new Error(`Could not find action ${action.type}`), state, send)
      }

      // allows (newState === oldState) checks
      return (reducersCalled) ? newState : state
    }

    // update the DOM after every state mutation
    // (obj, obj) -> null
    function onchange (action, newState, oldState) {
      if (newState === oldState) return
      handlers.onState(action, newState, oldState, send)
    }
  }
}

// compose an object conditionally
// optionally contains a namespace
// which is used to nest properties.
// (str, obj, obj) -> null
function apply (ns, source, target) {
  Object.keys(source).forEach(function (key) {
    if (ns) {
      if (!target[ns]) target[ns] = {}
      target[ns][key] = source[key]
    } else target[key] = source[key]
  })
}
