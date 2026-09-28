import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const nav = vi.hoisted(() => ({
  search: new URLSearchParams(),
  replace: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  useSearchParams: () => nav.search,
  useRouter: () => ({ replace: nav.replace }), // un objeto nuevo en cada render, a propósito
  usePathname: () => "/admin/usuarios",
}));

import { FlashToast, Toast, TOAST_DURATION_MS, useToast } from "./toast";

beforeEach(() => {
  // Solo los temporizadores del toast: con todos falsos, React se queda esperando.
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  nav.search = new URLSearchParams();
  nav.replace.mockReset();
});

afterEach(() => {
  vi.useRealTimers();
});

function Harness() {
  const toast = useToast();
  return (
    <>
      <button onClick={() => toast.show("Contraseña cambiada")}>ok</button>
      <button onClick={() => toast.show("Algo ha fallado", "error")}>ko</button>
      <Toast message={toast.message} onClose={toast.close} />
    </>
  );
}

describe("Toast", () => {
  it("sin mensaje no pinta nada", () => {
    render(<Toast message={null} onClose={() => {}} />);
    expect(screen.queryByTestId("toast")).toBeNull();
  });

  it("se anuncia sin robar el foco y se va solo a los 4 s", () => {
    render(<Harness />);
    fireEvent.click(screen.getByText("ok"));

    const toast = screen.getByTestId("toast");
    expect(toast.getAttribute("role")).toBe("status");
    expect(toast.getAttribute("aria-live")).toBe("polite");
    expect(toast.getAttribute("data-tone")).toBe("success");
    expect(toast.textContent).toContain("Contraseña cambiada");

    act(() => vi.advanceTimersByTime(TOAST_DURATION_MS - 1));
    expect(screen.queryByTestId("toast")).not.toBeNull();
    act(() => vi.advanceTimersByTime(1));
    expect(screen.queryByTestId("toast")).toBeNull();
  });

  it("se cierra con la X, y los errores van en rojo", () => {
    render(<Harness />);
    fireEvent.click(screen.getByText("ko"));
    expect(screen.getByTestId("toast").getAttribute("data-tone")).toBe("error");

    fireEvent.click(screen.getByLabelText("Cerrar aviso"));
    expect(screen.queryByTestId("toast")).toBeNull();
  });
});

describe("FlashToast", () => {
  const messages = { creado: "Usuario creado" };

  it("traduce ?aviso= y limpia la URL para que no vuelva al recargar", () => {
    nav.search = new URLSearchParams("aviso=creado");
    render(<FlashToast messages={messages} />);

    expect(screen.getByTestId("toast").textContent).toContain("Usuario creado");
    expect(nav.replace).toHaveBeenCalledWith("/admin/usuarios", { scroll: false });
  });

  it("un código desconocido no pinta nada, pero también se limpia", () => {
    nav.search = new URLSearchParams("aviso=inventado");
    render(<FlashToast messages={messages} />);

    expect(screen.queryByTestId("toast")).toBeNull();
    expect(nav.replace).toHaveBeenCalled();
  });

  it("sin aviso, ni toast ni navegación", () => {
    render(<FlashToast messages={messages} />);
    expect(screen.queryByTestId("toast")).toBeNull();
    expect(nav.replace).not.toHaveBeenCalled();
  });
});
