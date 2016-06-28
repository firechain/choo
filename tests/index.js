const tape = require('tape')
const store = require('../')

tape('setup', function (t) {
  t.test('throws error if not evoked with a function', function (t) {
    t.plan(1)
    t.throws(() => {
      store({
        onState: 1
      })
    }, 'throws if given non-function')
  })
})

tape('state, reducers, effects', function (t) {
  t.test('on by default', function (t) {
    t.plan(3)
    const app = store()
    app.model({
      state: {
        state: true
      },
      reducers: {
        reducer: () => t.pass('sends reducer')
      },
      effects: {
        effect: () => t.pass('sends effect')
      }
    })
    const send = app.start()
    t.ok(app.state().state, 'sets initial state')
    send('reducer')
    send('effect')
  })

  t.test('noState', function (t) {
    t.plan(1)
    const app = store()
    app.model({
      state: {
        hasState: true
      }
    })
    app.start({ noState: true })
    t.notOk(app.state().hasState, 'no initial state')
  })

  t.test('noReducers, noEffects', function (t) {
    t.plan(2)
    const app = store({
      onError: () => {
        t.pass('no effects or reducers')
      }
    })
    app.model({
      reducers: { reducer: () => true },
      effects: { effect: () => true }
    })
    const send = app.start({
      noReducers: true,
      noEffects: true
    })
    send('reducer')
    send('effect')
  })
})

tape('state', function (t) {
  t.test('state()', function (t) {
    t.plan(2)
    const app = store()
    app.model({
      state: {
        foo: 'bar'
      }
    })
    t.deepEqual(app.state(), {}, 'returns empty object if invoked before start()')
    app.start()
    t.deepEqual(app.state(), { foo: 'bar' }, 'returns state after invoking start()')
  })

  t.test('frozen state', function (t) {
    'use strict'

    t.plan(3)
    const app = store()
    app.model({
      state: {
        foo: 'bar'
      },
      effects: {
        effect: (action, state) => {
          t.throws(() => { state.foo = 'baz' }, 'initial state is frozen')
        }
      },
      reducers: {
        mutates: (action, state) => {
          t.throws(() => { state.foo = 'baz' }, 'state frozen for reducer')
        },
        extends: (action, state) => ({ foo: 'this is fine' })
      }
    })
    const send = app.start()
    send('extends')
    send('mutates')
    send('effect')
    let state = app.state()
    t.throws(() => { state.foo = 'baz' }, 'state() is frozen')
  })

  t.test('checking equality', function (t) {
    const app = store({
      onState: () => t.fail('should not call onState')
    })
    app.model({
      state: {
        foo: 'bar'
      },
      effects: {
        noop: () => true
      }
    })
    const send = app.start()
    send('noop')
    setTimeout(t.end, 5)
  })
})

tape('handlers', function (t) {
  t.test('onError', function (t) {
    t.plan(1)
    const app = store({
      onError: function (error, state, send) {
        t.ok(error instanceof Error, 'returns error object')
      }
    })
    const send = app.start()
    send('nonexistant:reducer')
  })

  t.test('onAction', function (t) {
    t.plan(2)
    const app = store({
      onAction: function (action, state, caller, send) {
        t.equals(caller, 'touch', 'returns action name')
        t.ok(state.untouched, 'fires before reducer changes state')
      }
    })
    app.model({
      state: {
        untouched: true
      },
      reducers: {
        touch: (action, state) => ({ untouched: false })
      }
    })
    const send = app.start()
    send('touch')
  })

  t.test('onState', function (t) {
    t.plan(3)
    var i = 0
    const app = store({
      onState: function (action, state, prev, send) {
        i += 1
        t.equals(prev.foo, 'bar', 'returns old state')
        t.equals(state.foo, 'baz', 'returns new state')
        t.equals(i, 1, 'only trigger if reducer is called')
      }
    })
    app.model({
      state: {
        foo: 'bar'
      },
      reducers: {
        foo: (action, state) => ({ foo: action.value })
      },
      effects: {
        noop: (action, state) => true
      }
    })
    const send = app.start()
    send('noop')
    send('foo', { value: 'baz' })
  })
})
