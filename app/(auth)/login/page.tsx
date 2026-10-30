import LoginForm from "@/components/login-form";

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-12">
      <section className="w-full max-w-md rounded-2xl bg-white p-8 shadow-sm ring-1 ring-slate-200">
        <div className="mb-8">
          <p className="mb-2 text-sm font-semibold uppercase tracking-wide text-indigo-600">
            El cuchitril de WALL y Eva
          </p>
          <h1 className="text-3xl font-bold text-slate-950">Iniciar sesión</h1>
          <p className="mt-2 text-sm text-slate-600">
            Accede al panel de ventas de tu colección.
          </p>
        </div>
        <LoginForm />
      </section>
    </main>
  );
}
