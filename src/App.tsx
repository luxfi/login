import { Route, Switch, Link } from 'wouter'
import { LoginPage } from './pages/LoginPage'
import { SignupPage } from './pages/SignupPage'
import { ForgotPage } from './pages/ForgotPage'
import { CallbackPage } from './pages/CallbackPage'

export function App() {
  return (
    <div className="app">
      <main className="center">
        <Switch>
          <Route path="/" component={LoginPage} />
          <Route path="/login" component={LoginPage} />
          <Route path="/signup" component={SignupPage} />
          <Route path="/forgot" component={ForgotPage} />
          <Route path="/callback" component={CallbackPage} />
          <Route>
            <div className="card">
              <h1 style={{ fontSize: 32, marginBottom: 8 }}>404</h1>
              <p style={{ color: 'var(--muted)', marginBottom: 16 }}>
                Page not found.
              </p>
              <Link href="/">Return to sign in</Link>
            </div>
          </Route>
        </Switch>
      </main>
      <footer className="site-footer">Lux Network</footer>
    </div>
  )
}
