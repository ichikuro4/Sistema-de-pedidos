import Image from "next/image";
import LoginForm from "@/components/login-form";

export default function LoginPage() {
  return (
    <main className="app-canvas grid min-h-screen md:grid-cols-[1fr_1fr]">
      <section className="relative hidden overflow-hidden bg-[#153b42] px-10 py-12 text-white md:flex md:flex-col md:justify-between xl:px-20">
        <div className="absolute -right-20 -top-20 h-80 w-80 rounded-full border-[46px] border-[#e6b359]/20" />
        <div className="absolute -bottom-36 -left-28 h-96 w-96 rounded-full bg-[#6ec3c3]/10" />
        <div className="relative flex items-center gap-3">
          <Image src="/icon.svg" width={52} height={52} alt="" className="rounded-2xl" priority />
          <div><p className="text-[10px] font-extrabold uppercase tracking-[.18em] text-[#a8d5cc]">El cuchitril de</p><p className="text-xl font-extrabold">WALL y Eva</p></div>
        </div>
        <div className="relative max-w-lg pb-10">
          <span className="inline-flex rounded-full border border-[#a5d2ca]/30 bg-white/10 px-4 py-2 text-xs font-semibold tracking-wide text-[#cce9df]">TU PEQUEÑO UNIVERSO DE FIGURITAS</span>
          <h2 className="mt-7 text-5xl font-extrabold leading-[1.08] tracking-[-.05em] xl:text-6xl">Cada figura tiene una historia. <span className="text-[#f1b457]">Cada venta también.</span></h2>
          <p className="mt-6 max-w-md text-base leading-relaxed text-[#c6dcda]">Un espacio sencillo para llevar tus pedidos, registrar pagos y saber exactamente qué falta por cobrar.</p>
        </div>
        <p className="relative text-xs font-medium text-[#a5c4c0]">Hecho para el día a día de WALL y Eva.</p>
      </section>
      <section className="flex min-h-screen items-center justify-center px-5 py-10 sm:px-10">
        <div className="w-full max-w-[440px]">
          <div className="mb-8 flex items-center gap-3 md:hidden">
            <Image src="/icon.svg" width={50} height={50} alt="" className="rounded-2xl" priority />
            <div><p className="ui-eyebrow">El cuchitril de</p><p className="text-xl font-extrabold tracking-tight text-[#1a3b40]">WALL y Eva</p></div>
          </div>
          <div className="ui-panel p-6 sm:p-9">
            <p className="ui-eyebrow">Bienvenido de vuelta</p>
            <h1 className="ui-title mt-2">Tu tienda te espera.</h1>
            <p className="ui-muted mt-3 text-sm leading-relaxed">Ingresa con tu correo y contraseña para seguir con tus ventas.</p>
            <div className="mt-8"><LoginForm /></div>
          </div>
          <p className="mt-5 text-center text-xs text-[#869490]">Acceso privado para el equipo de la tienda.</p>
        </div>
      </section>
    </main>
  );
}
