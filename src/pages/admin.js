import Head from 'next/head';
import { useState } from 'react';
import { SITE_NAME } from '@/lib/site';
import { TIERS, formatPrice } from '@/lib/pricing';

// ============================================================
// Simple admin/fulfilment screen.
//   - password gate (ADMIN_SECRET)
//   - order list with status + a "mark shipped" action
// Not linked from anywhere in the UI; reach it at /admin.
// ============================================================

const STATUSES = ['pending', 'paid', 'shipped', 'failed', 'refunded'];

function statusClass(status) {
  if (status === 'paid') return 'status status-paid';
  if (status === 'shipped') return 'status status-shipped';
  if (status === 'failed' || status === 'refunded') return 'status status-bad';
  return 'status';
}

export default function Admin() {
  const [password, setPassword] = useState('');
  const [orders, setOrders] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function signIn(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const res = await fetch('/api/admin/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error || 'Sign in failed.');
      } else {
        setOrders(data.orders || []);
        setPassword('');
      }
    } catch {
      setError('Network error.');
    } finally {
      setBusy(false);
    }
  }

  async function setStatus(id, status) {
    setBusy(true);
    try {
      const res = await fetch('/api/admin/orders', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status }),
      });
      const data = await res.json().catch(() => null);
      if (res.ok && data?.orders) setOrders(data.orders);
      else setError(data?.error || 'Update failed.');
    } catch {
      setError('Network error.');
    } finally {
      setBusy(false);
    }
  }

  function formatAddress(a) {
    if (!a) return '—';
    return [a.line1, a.line2, a.city, a.state, a.postal_code, a.country].filter(Boolean).join(', ');
  }

  return (
    <>
      <Head>
        <title>{`Admin · ${SITE_NAME}`}</title>
        <meta name="robots" content="noindex, nofollow" />
      </Head>
      <main className="legal" style={{ maxWidth: 1000 }}>
        <h1>Orders</h1>
        <p className="updated">Fulfilment dashboard — mark printed certificates as shipped.</p>

        {orders === null ? (
          <form onSubmit={signIn} style={{ maxWidth: 360 }}>
            <div className="field">
              <label htmlFor="admin-password">Admin password</label>
              <input
                id="admin-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
              />
            </div>
            {error && <div className="form-error">{error}</div>}
            <button className="btn btn-gold" type="submit" disabled={busy || !password}>
              {busy ? 'Checking…' : 'Sign in'}
            </button>
          </form>
        ) : (
          <>
            {error && <div className="form-error" style={{ textAlign: 'left' }}>{error}</div>}
            <div style={{ overflowX: 'auto', marginTop: 20 }}>
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Email</th>
                    <th>Tier</th>
                    <th>Amount</th>
                    <th>Status</th>
                    <th>Ship to</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((o) => (
                    <tr key={o.id}>
                      <td>{new Date(o.created_at).toLocaleDateString()}</td>
                      <td>{o.email || '—'}</td>
                      <td>{TIERS[o.tier]?.name || o.tier}</td>
                      <td>{formatPrice(o.amount_cents)}</td>
                      <td>
                        <span className={statusClass(o.status)}>{o.status}</span>
                      </td>
                      <td>
                        {o.tier === 'heirloom' ? (
                          <>
                            <strong>{o.shipping_name || '—'}</strong>
                            <div style={{ fontSize: 12, color: 'var(--ink-soft)' }}>
                              {formatAddress(o.shipping_address)}
                            </div>
                          </>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td>
                        <select
                          value={o.status}
                          disabled={busy}
                          onChange={(e) => setStatus(o.id, e.target.value)}
                          aria-label={`Status for order ${o.id}`}
                        >
                          {STATUSES.map((s) => (
                            <option key={s} value={s}>
                              {s}
                            </option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  ))}
                  {orders.length === 0 && (
                    <tr>
                      <td colSpan={7} style={{ textAlign: 'center', padding: 24 }}>
                        No orders yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </main>
    </>
  );
}
