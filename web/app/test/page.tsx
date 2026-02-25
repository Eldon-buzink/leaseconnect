export default function TestPage() {
  return (
    <div
      style={{
        padding: 40,
        fontFamily: 'system-ui, sans-serif',
        color: '#111',
        fontSize: 18,
        background: '#fff',
        margin: 20,
        borderRadius: 8,
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
      }}
    >
      <h1 style={{ marginTop: 0 }}>Leaseconnect test</h1>
      <p>If you see this, the app is rendering.</p>
      <p style={{ color: '#666', fontSize: 14 }}>
        If the page is still blank, use View → Developer → View Source and search for
        &quot;Leaseconnect test&quot; to see if the HTML is present.
      </p>
    </div>
  );
}
