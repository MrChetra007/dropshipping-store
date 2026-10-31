"use client";

import Image from "next/image";
import { useMemo, useState, type FormEvent } from "react";

import { Input } from "@/components/ui/input";
import { formatCents } from "@/lib/utils";
import type { Cart } from "@/types/cart";

export type CheckoutShippingRate = {
  name: string;
  countryCode: string;
  amountCents: number;
  freeOverCents: number | null;
  minDays: number | null;
  maxDays: number | null;
};

const COUNTRIES = [
  { code: "US", name: "United States" },
  { code: "GB", name: "United Kingdom" },
  { code: "CA", name: "Canada" },
  { code: "AU", name: "Australia" },
  { code: "NZ", name: "New Zealand" },
  { code: "IE", name: "Ireland" },
  { code: "DE", name: "Germany" },
  { code: "FR", name: "France" },
  { code: "NL", name: "Netherlands" },
  { code: "ES", name: "Spain" },
  { code: "IT", name: "Italy" },
  { code: "SE", name: "Sweden" },
  { code: "DK", name: "Denmark" },
  { code: "NO", name: "Norway" },
  { code: "BE", name: "Belgium" },
  { code: "AT", name: "Austria" },
  { code: "CH", name: "Switzerland" },
  { code: "JP", name: "Japan" },
  { code: "SG", name: "Singapore" },
  { code: "HK", name: "Hong Kong" },
  { code: "MY", name: "Malaysia" },
  { code: "TH", name: "Thailand" },
  { code: "VN", name: "Vietnam" },
  { code: "PH", name: "Philippines" },
  { code: "IN", name: "India" },
  { code: "AE", name: "United Arab Emirates" },
  { code: "SA", name: "Saudi Arabia" },
  { code: "ZA", name: "South Africa" },
  { code: "BR", name: "Brazil" },
  { code: "MX", name: "Mexico" },
];

const fieldClass =
  "h-11 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm text-zinc-900 outline-none transition-colors placeholder:text-zinc-400 focus:border-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:border-zinc-300";

function ratesForCountry(
  rates: CheckoutShippingRate[],
  countryCode: string,
): CheckoutShippingRate[] {
  const specific = rates.filter(
    (rate) => rate.countryCode === countryCode,
  );

  if (specific.length > 0) {
    return specific;
  }

  return rates.filter((rate) => rate.countryCode === "*");
}

function shippingCentsFor(
  rate: CheckoutShippingRate | undefined,
  subtotalCents: number,
): number {
  if (!rate) {
    return 0;
  }

  if (rate.freeOverCents !== null && subtotalCents >= rate.freeOverCents) {
    return 0;
  }

  return rate.amountCents;
}

export function CheckoutForm({
  cart,
  rates,
  defaults,
}: {
  cart: Cart;
  rates: CheckoutShippingRate[];
  defaults: { email: string; name: string };
}) {
  const initialCountry = "US";
  const initialRates = ratesForCountry(rates, initialCountry);

  const [email, setEmail] = useState(defaults.email);
  const [name, setName] = useState(defaults.name);
  const [phone, setPhone] = useState("");
  const [line1, setLine1] = useState("");
  const [line2, setLine2] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [countryCode, setCountryCode] = useState(initialCountry);
  const [rateName, setRateName] = useState(initialRates[0]?.name ?? "");
  const [discountCode, setDiscountCode] = useState("");
  const [note, setNote] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const countryRates = useMemo(
    () => ratesForCountry(rates, countryCode),
    [rates, countryCode],
  );

  const selectedRate =
    countryRates.find((rate) => rate.name === rateName) ?? countryRates[0];
  const shippingCents = shippingCentsFor(selectedRate, cart.subtotalCents);
  const totalCents = cart.subtotalCents + shippingCents;

  const changeCountry = (code: string) => {
    setCountryCode(code);
    const nextRates = ratesForCountry(rates, code);
    setRateName(nextRates[0]?.name ?? "");
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (submitting) {
      return;
    }

    if (!selectedRate) {
      setErrorMessage("Shipping is not available for this country.");
      return;
    }

    setSubmitting(true);
    setErrorMessage(null);

    try {
      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          shipping: {
            name: name.trim(),
            phone: phone.trim() || null,
            line1: line1.trim(),
            line2: line2.trim() || null,
            city: city.trim(),
            state: state.trim() || null,
            postalCode: postalCode.trim(),
            countryCode,
          },
          shippingRateName: selectedRate.name,
          discountCode: discountCode.trim() || null,
          note: note.trim() || null,
        }),
      });
      const data = (await response.json()) as {
        error?: string;
        redirectUrl?: string;
      };

      if (!response.ok || !data.redirectUrl) {
        throw new Error(data.error ?? "Could not start checkout");
      }

      window.location.assign(data.redirectUrl);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Could not start checkout",
      );
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={submit} className="grid gap-8 lg:grid-cols-[1.3fr_0.7fr]">
      <div className="space-y-8">
        <section className="space-y-4">
          <h2 className="text-lg font-semibold tracking-tight">Contact</h2>
          <label className="block space-y-1.5 text-sm">
            <span className="font-medium">Email</span>
            <Input
              type="email"
              name="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
            />
          </label>
          <p className="text-xs text-zinc-500">
            Your order confirmation and tracking updates are sent here.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-lg font-semibold tracking-tight">
            Shipping address
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block space-y-1.5 text-sm sm:col-span-2">
              <span className="font-medium">Full name</span>
              <Input
                name="name"
                autoComplete="name"
                required
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </label>
            <label className="block space-y-1.5 text-sm sm:col-span-2">
              <span className="font-medium">Address line 1</span>
              <Input
                name="line1"
                autoComplete="address-line1"
                required
                value={line1}
                onChange={(event) => setLine1(event.target.value)}
              />
            </label>
            <label className="block space-y-1.5 text-sm sm:col-span-2">
              <span className="font-medium">
                Address line 2{" "}
                <span className="font-normal text-zinc-500">(optional)</span>
              </span>
              <Input
                name="line2"
                autoComplete="address-line2"
                value={line2}
                onChange={(event) => setLine2(event.target.value)}
              />
            </label>
            <label className="block space-y-1.5 text-sm">
              <span className="font-medium">City</span>
              <Input
                name="city"
                autoComplete="address-level2"
                required
                value={city}
                onChange={(event) => setCity(event.target.value)}
              />
            </label>
            <label className="block space-y-1.5 text-sm">
              <span className="font-medium">
                State / region{" "}
                <span className="font-normal text-zinc-500">(optional)</span>
              </span>
              <Input
                name="state"
                autoComplete="address-level1"
                value={state}
                onChange={(event) => setState(event.target.value)}
              />
            </label>
            <label className="block space-y-1.5 text-sm">
              <span className="font-medium">Postal code</span>
              <Input
                name="postalCode"
                autoComplete="postal-code"
                required
                value={postalCode}
                onChange={(event) => setPostalCode(event.target.value)}
              />
            </label>
            <label className="block space-y-1.5 text-sm">
              <span className="font-medium">Country</span>
              <select
                name="countryCode"
                autoComplete="country"
                value={countryCode}
                onChange={(event) => changeCountry(event.target.value)}
                className={fieldClass}
              >
                {COUNTRIES.map((country) => (
                  <option key={country.code} value={country.code}>
                    {country.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block space-y-1.5 text-sm sm:col-span-2">
              <span className="font-medium">
                Phone{" "}
                <span className="font-normal text-zinc-500">(optional)</span>
              </span>
              <Input
                name="phone"
                autoComplete="tel"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
              />
            </label>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-lg font-semibold tracking-tight">Shipping</h2>
          {countryRates.length > 0 ? (
            <div className="space-y-2">
              {countryRates.map((rate) => (
                <label
                  key={`${rate.countryCode}-${rate.name}`}
                  className="flex cursor-pointer items-center justify-between gap-4 rounded-lg border border-zinc-200 px-4 py-3 text-sm has-checked:border-zinc-900 dark:border-zinc-800 dark:has-checked:border-zinc-100"
                >
                  <span className="flex items-center gap-3">
                    <input
                      type="radio"
                      name="shippingRate"
                      value={rate.name}
                      checked={selectedRate?.name === rate.name}
                      onChange={() => setRateName(rate.name)}
                      className="h-4 w-4"
                    />
                    <span>
                      <span className="font-medium">{rate.name}</span>
                      <span className="block text-xs text-zinc-500">
                        {rate.minDays !== null && rate.maxDays !== null
                          ? `${rate.minDays}–${rate.maxDays} business days`
                          : "Delivery time confirmed after dispatch"}
                      </span>
                    </span>
                  </span>
                  <span className="text-right text-sm">
                    {shippingCentsFor(rate, cart.subtotalCents) === 0 ? (
                      <span className="font-medium text-emerald-700 dark:text-emerald-400">
                        Free
                      </span>
                    ) : (
                      formatCents(rate.amountCents, cart.currency)
                    )}
                    {rate.freeOverCents !== null ? (
                      <span className="block text-xs text-zinc-500">
                        Free over{" "}
                        {formatCents(rate.freeOverCents, cart.currency)}
                      </span>
                    ) : null}
                  </span>
                </label>
              ))}
            </div>
          ) : (
            <p className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
              Shipping is not available for this country yet. Choose another
              country or contact support.
            </p>
          )}
        </section>

        <section className="space-y-4">
          <h2 className="text-lg font-semibold tracking-tight">
            Discount &amp; notes
          </h2>
          <label className="block space-y-1.5 text-sm">
            <span className="font-medium">
              Discount code{" "}
              <span className="font-normal text-zinc-500">(optional)</span>
            </span>
            <Input
              name="discountCode"
              value={discountCode}
              onChange={(event) => setDiscountCode(event.target.value)}
              placeholder="Enter a code"
            />
          </label>
          <label className="block space-y-1.5 text-sm">
            <span className="font-medium">
              Order note{" "}
              <span className="font-normal text-zinc-500">(optional)</span>
            </span>
            <textarea
              name="note"
              rows={3}
              value={note}
              onChange={(event) => setNote(event.target.value)}
              className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition-colors placeholder:text-zinc-400 focus:border-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:border-zinc-300"
            />
          </label>
        </section>
      </div>

      <aside className="h-fit space-y-4 rounded-xl border border-zinc-200 p-5 dark:border-zinc-800">
        <h2 className="font-medium">Order summary</h2>

        <ul className="space-y-3">
          {cart.items.map((item) => (
            <li key={item.id} className="flex gap-3">
              <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-md bg-zinc-100 dark:bg-zinc-900">
                {item.imageUrl ? (
                  <Image
                    src={item.imageUrl}
                    alt=""
                    fill
                    sizes="48px"
                    className="object-cover"
                  />
                ) : null}
              </div>
              <div className="min-w-0 flex-1 text-sm">
                <p className="line-clamp-2">{item.productTitle}</p>
                <p className="text-xs text-zinc-500">
                  {item.variantTitle !== "Default"
                    ? `${item.variantTitle} · `
                    : ""}
                  Qty {item.quantity}
                </p>
              </div>
              <p className="text-sm">
                {formatCents(item.lineTotalCents, item.currency)}
              </p>
            </li>
          ))}
        </ul>

        <dl className="space-y-2 border-t border-zinc-200 pt-3 text-sm dark:border-zinc-800">
          <div className="flex items-center justify-between">
            <dt className="text-zinc-500">Subtotal</dt>
            <dd>{formatCents(cart.subtotalCents, cart.currency)}</dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="text-zinc-500">Shipping</dt>
            <dd>
              {selectedRate
                ? shippingCents === 0
                  ? "Free"
                  : formatCents(shippingCents, cart.currency)
                : "—"}
            </dd>
          </div>
          <div className="flex items-center justify-between border-t border-zinc-200 pt-2 font-semibold dark:border-zinc-800">
            <dt>Total</dt>
            <dd>{formatCents(totalCents, cart.currency)}</dd>
          </div>
        </dl>

        {errorMessage ? (
          <p
            role="alert"
            className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300"
          >
            {errorMessage}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={submitting || !selectedRate}
          className="flex h-11 w-full items-center justify-center rounded-md bg-zinc-900 px-5 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          {submitting ? "Starting checkout…" : "Continue to payment"}
        </button>

        <p className="text-xs text-zinc-500">
          Totals are recalculated securely on the server. Discounts are applied
          after the code is validated.
        </p>
      </aside>
    </form>
  );
}
