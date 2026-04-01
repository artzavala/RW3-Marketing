export default function RepDashboard() {
  return (
    <div>
      <h1 className="text-2xl font-bold">My Dashboard</h1>
      <p className="mt-2 text-muted-foreground">
        View your assigned clients and recent signals.
      </p>
      <div className="mt-8 grid gap-4 md:grid-cols-2">
        <div className="rounded-lg border p-6">
          <h3 className="font-semibold">My Clients</h3>
          <p className="mt-1 text-sm text-muted-foreground">No clients assigned yet.</p>
        </div>
        <div className="rounded-lg border p-6">
          <h3 className="font-semibold">Recent Signals</h3>
          <p className="mt-1 text-sm text-muted-foreground">No signals yet.</p>
        </div>
      </div>
    </div>
  )
}
