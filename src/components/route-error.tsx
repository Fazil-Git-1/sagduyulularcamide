export function SayfaError({ error }: { error: Error }) {
  return (
    <div className="p-8 text-center text-sm text-muted-foreground" role="alert">
      Sayfa yüklenemedi: {error.message}
    </div>
  );
}

export function TabloError({ error }: { error: Error }) {
  return (
    <div className="p-8 text-center text-sm text-muted-foreground" role="alert">
      Tablo yüklenemedi: {error.message}
    </div>
  );
}

export default SayfaError;
