import { type FormEvent, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../../contexts/AuthContext';
import { getRegisterUrl, resolvePostAuthRedirect } from '../../lib/authRedirect';
import { AuthFormDivider, GoogleSignInButton } from '../../components/auth/GoogleSignInButton';
import { Logo } from '../../components/brand/Logo';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';

export default function LoginPage() {
  const { login, loginWithGoogle } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirectTo = searchParams.get('redirect');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  async function handleGoogleCredential(idToken: string) {
    setError('');
    setGoogleLoading(true);
    try {
      const user = await loginWithGoogle(idToken);
      navigate(resolvePostAuthRedirect(redirectTo, user.role), { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Google sign-in failed');
    } finally {
      setGoogleLoading(false);
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const user = await login(email, password);
      navigate(resolvePostAuthRedirect(redirectTo, user.role), { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  const closedAccount = error.includes('Register again');

  return (
    <div className="flex min-h-[calc(100dvh-5rem)] w-full items-center justify-center bg-white px-4 py-16 lg:min-h-[calc(100dvh-6rem)]">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md rounded-2xl border border-border-light bg-elevated p-6 shadow-[var(--shadow-elevated)] sm:p-8"
      >
        <div className="flex justify-center">
          <Logo size="lg" />
        </div>
        <h1 className="mt-6 text-center font-display text-2xl font-bold text-ink">Welcome Back</h1>
        <p className="mt-1 text-sm text-ink-muted">Sign in to your Crown Ev account</p>

        <div className="mt-8">
          {error && (
            <div className="mb-4 rounded-xl bg-red-50 p-3 text-sm text-warning">
              <p>{error}</p>
              {closedAccount && (
                <p className="mt-2">
                  <Link to={getRegisterUrl(redirectTo ?? undefined)} className="font-medium text-brand-light hover:underline">
                    Register again
                  </Link>
                </p>
              )}
            </div>
          )}
          <GoogleSignInButton
            onCredential={handleGoogleCredential}
            onConfigError={setError}
            loading={googleLoading}
            disabled={loading}
          />
          <AuthFormDivider />
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Email"
            type="email"
            required
            placeholder="example@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <Input
            label="Password"
            type="password"
            passwordToggle
            required
            placeholder="Enter your password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <Button type="submit" variant="accent" className="w-full" loading={loading}>Sign In</Button>
        </form>

        <div className="mt-6 text-center text-sm text-ink-muted space-y-2">
          <p><Link to="/forgot-password" className="text-brand-light hover:underline">Forgot password?</Link></p>
          <p>No account? <Link to={getRegisterUrl(redirectTo ?? undefined)} className="text-brand-light font-medium">Register</Link></p>
        </div>
      </motion.div>
    </div>
  );
}
