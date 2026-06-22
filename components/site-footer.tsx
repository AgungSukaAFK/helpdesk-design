export function SiteFooter() {
  return (
    <footer className="border-t border-border">
      <div className="container mx-auto flex flex-col items-center justify-between gap-6 px-4 py-8 sm:flex-row">
        <p className="text-sm text-muted-foreground">
          © {new Date().getFullYear()} DesignDesk. All rights reserved.
        </p>
        <div className="flex gap-6">
          <a
            href="/artikel"
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            Artikel
          </a>
          <a
            href="#"
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            Ketentuan
          </a>
          <a
            href="#"
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            Privasi
          </a>
        </div>
      </div>
    </footer>
  );
}
