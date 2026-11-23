import React, { useEffect, useState } from "react";
import { View, Text, Pressable, ActivityIndicator } from "react-native";
const messages = {
  created: "Рахунок очікує оплати",
  processing: "Оплата обробляється",
  hold: "Кошти зарезервовано",
  success: "Оплату підтверджено",
  failure: "Оплату не завершено",
  reversed: "Платіж повернено",
  expired: "Час оплати минув",
  creating: "Рахунок створюється",
  awaiting_payment_on_delivery: "Оплата при отриманні",
  creation_unconfirmed: "Створення рахунку потребує перевірки",
};
export default function PaymentResult({ orderId }) {
  const [result, setResult] = useState(null),
    [error, setError] = useState(""),
    [retry, setRetry] = useState(0),
    [checking, setChecking] = useState(true);
  useEffect(() => {
    let stopped = false,
      timer,
      attempt = 0;
    const controller = new AbortController();
    async function check() {
      setChecking(true);
      setError("");
      try {
        const response = await fetch(
          "/api/payments/status?orderId=" + encodeURIComponent(orderId),
          { signal: controller.signal },
        );
        const data = await response.json();
        if (!response.ok)
          throw new Error(data.error || "Не вдалося перевірити оплату.");
        if (stopped) return;
        setResult(data);
        if (
          ["created", "processing", "hold"].includes(data.status) &&
          ++attempt < 12
        )
          timer = setTimeout(check, 5000);
      } catch (e) {
        if (!stopped)
          setError(
            e.name === "TypeError"
              ? "Перевірте з’єднання та повторіть перевірку."
              : e.message,
          );
      } finally {
        if (!stopped) setChecking(false);
      }
    }
    check();
    return () => {
      stopped = true;
      clearTimeout(timer);
      controller.abort();
    };
  }, [orderId, retry]);
  const button = {
    paddingVertical: 14,
    paddingHorizontal: 22,
    minHeight: 48,
    borderRadius: 13,
    backgroundColor: "#57951f",
    alignItems: "center",
  };
  return (
    <View
      style={{
        minHeight: "100dvh",
        backgroundColor: "#dceafb",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
      }}
    >
      <View
        style={{
          width: "100%",
          maxWidth: 580,
          padding: 32,
          gap: 20,
          borderRadius: 28,
          backgroundColor: "#fffefa",
        }}
      >
        <Text
          style={{
            fontFamily: "Inter",
            fontSize: 12,
            letterSpacing: 2,
            color: "#72904e",
          }}
        >
          МАГНІТНІ ШАХИ
        </Text>
        <Text
          role="heading"
          aria-level={1}
          style={{
            fontFamily: "Inter",
            fontSize: 30,
            fontWeight: "700",
            color: "#23272a",
          }}
        >
          {result
            ? messages[result.status] || "Статус замовлення уточнюється"
            : "Перевіряємо оплату"}
        </Text>
        {checking && <ActivityIndicator color="#57951f" />}
        {result && (
          <Text style={{ fontFamily: "Inter", fontSize: 18, color: "#424f36" }}>
            Магнітні Шахи · {result.quantity} шт. ·{" "}
            {(result.amount / 100).toFixed(2)} ₴
          </Text>
        )}
        {result?.status === "success" && (
          <Text
            style={{
              fontFamily: "Inter",
              fontSize: 15,
              lineHeight: 23,
              color: "#424f36",
            }}
          >
            Дякуємо! Оплату підтверджено банком. Дані замовлення збережено.
          </Text>
        )}
        {error && (
          <Text
            role="alert"
            style={{ fontFamily: "Inter", fontSize: 14, color: "#a63827" }}
          >
            {error}
          </Text>
        )}
        {result?.pageUrl && !error && (
          <Pressable
            role="button"
            onPress={() => window.location.assign(result.pageUrl)}
            style={button}
          >
            <Text style={{ fontFamily: "Inter", fontSize: 15, color: "white" }}>
              Повернутися до оплати
            </Text>
          </Pressable>
        )}
        {result?.status !== "success" && (
          <Pressable
            role="button"
            disabled={checking}
            onPress={() => setRetry((n) => n + 1)}
            style={[button, { backgroundColor: "#edf3e7" }]}
          >
            <Text
              style={{ fontFamily: "Inter", fontSize: 15, color: "#424f36" }}
            >
              Перевірити статус
            </Text>
          </Pressable>
        )}
        <Pressable
          role="link"
          href={import.meta.env.BASE_URL}
          style={{ padding: 12, alignItems: "center" }}
        >
          <Text style={{ fontFamily: "Inter", fontSize: 14, color: "#57951f" }}>
            Повернутися до магазину
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
