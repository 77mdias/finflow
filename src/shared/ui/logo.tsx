import Image from "next/image";

/**
 * Marca do FinFlow: ícone à esquerda e nome à direita (public/brand).
 * O nome é monocromático e vira máscara, então segue a cor do texto do tema (claro/escuro).
 */
export function Logo({ priority = false }: { priority?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <Image
        src="/brand/logo-mark.png"
        alt=""
        width={146}
        height={108}
        priority={priority}
        className="h-9 w-auto"
      />
      <span
        aria-hidden
        className="h-5 w-[103px] bg-fg [mask:url(/brand/logo-name.png)_center/contain_no-repeat]"
      />
      <span className="sr-only">FinFlow</span>
    </span>
  );
}
