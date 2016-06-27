const tape = require('tape')
const store = require('../')

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
