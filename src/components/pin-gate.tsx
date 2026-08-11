import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Lock } from "lucide-react";

export function PinGate({
  pin,
  title,
  description,
  onSuccess,
}: {
  pin: string;
  title: string;
  description: string;
  onSuccess: () => void;
}) {
  const [digits, setDigits] = useState(["", "", "", ""]);
  const [error, setError] = useState(false);
  const refs = useRef<Array<HTMLInputElement | null>>([]);

  function check(next: string[]) {
    if (next.join("").length !== 4) return;
    if (next.join("") === pin) {
      onSuccess();
    } else {
      setError(true);
      setDigits(["", "", "", ""]);
      refs.current[0]?.focus();
    }
  }

  function setDigit(index: number, raw: string) {
    const value = raw.replace(/\D/g, "");
    setError(false);
    if (!value) {
      const next = [...digits];
      next[index] = "";
      setDigits(next);
      return;
    }
    const next = [...digits];
    // Support paste of the full code.
    value.split("").forEach((ch, k) => {
      if (index + k < 4) next[index + k] = ch;
    });
    setDigits(next);
    const focusAt = Math.min(index + value.length, 3);
    refs.current[focusAt]?.focus();
    check(next);
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        check(digits);
      }}
      className="mx-auto mt-6 max-w-sm rounded-3xl border border-border bg-card p-5 text-center shadow-soft sm:p-6"
    >
      <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-secondary">
        <Lock className="h-5 w-5 text-primary" aria-hidden />
      </div>
      <h2 className="mt-4 text-base font-semibold text-foreground">{title}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{description}</p>

      <div className="mt-5 flex justify-center gap-2.5">
        {digits.map((d, i) => (
          <input
            key={i}
            ref={(el) => {
              refs.current[i] = el;
            }}
            value={d}
            inputMode="numeric"
            autoComplete="one-time-code"
            autoFocus={i === 0}
            maxLength={4}
            aria-label={`PIN ${i + 1}. hane`}
            onChange={(e) => setDigit(i, e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Backspace" && !digits[i] && i > 0) {
                refs.current[i - 1]?.focus();
              }
            }}
            className="h-14 w-14 rounded-2xl border border-input bg-background text-center text-2xl font-bold text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-ring/40"
          />
        ))}
      </div>

      {error && <p className="mt-3 text-sm text-destructive">Hatalı PIN kodu.</p>}

      <Button
        type="submit"
        className="mt-5 h-12 w-full text-base"
        disabled={digits.join("").length !== 4}
      >
        Giriş Yap
      </Button>
    </form>
  );
}
