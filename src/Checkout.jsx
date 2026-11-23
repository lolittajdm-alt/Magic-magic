import { buildTelegramOrder, telegramOrderUrl } from "./telegramOrder.js";
import { assetUrl } from "./assetUrl.js";
import React, { useEffect, useRef, useState } from "react";
import { formatPhone } from "./phone.js";
import { useControlScale } from "./useControlScale.js";
import {
  View,
  Text,
  Image,
  TextInput,
  Pressable,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
  useWindowDimensions,
} from "react-native";
import {
  MapPin,
  Check,
  ChevronDown,
  ArrowRight,
  Minus,
  Plus,
  UserRound,
  Phone,
  ShieldCheck,
  Pencil,
} from "lucide-react";

const UNIT_PRICE = 10;
const formatPrice = (amount) => `${amount.toFixed(2)} ₴`;

function SearchField({
  label,
  placeholder,
  value,
  onSelect,
  endpoint,
  disabled = false,
  resetKey,
}) {
  const { size, target } = useControlScale();
  const [query, setQuery] = useState(value?.name || ""),
    [items, setItems] = useState([]),
    [open, setOpen] = useState(false),
    [loading, setLoading] = useState(false),
    [error, setError] = useState(""),
    [retry, setRetry] = useState(0);
  const generation = useRef(0);
  useEffect(() => {
    setQuery(value?.name || "");
    setItems([]);
    setOpen(false);
    setError("");
  }, [resetKey]);
  useEffect(() => {
    const current = ++generation.current;
    if (disabled || !open) {
      setLoading(false);
      return;
    }
    if (!endpoint.includes("warehouses") && query.trim().length < 2) {
      setItems([]);
      setError("");
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    setError("");
    setItems([]);
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(
          `${endpoint}${endpoint.includes("?") ? "&" : "?"}q=${encodeURIComponent(query)}`,
          { signal: controller.signal },
        );
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Спробуйте ще раз.");
        if (current === generation.current)
          setItems(Array.isArray(result.items) ? result.items : []);
      } catch (e) {
        if (e.name !== "AbortError" && current === generation.current)
          setError(e.message);
      } finally {
        if (current === generation.current) setLoading(false);
      }
    }, 300);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, open, endpoint, disabled, retry]);
  const choose = (item) => {
    onSelect(item);
    setQuery(item.name);
    setOpen(false);
    setItems([]);
  };
  return (
    <View style={{ marginBottom: 18 }}>
      <Text style={s.label}>{label}</Text>
      <View
        dataSet={{ checkoutField: "true" }}
        style={[
          s.searchBox,
          disabled && { backgroundColor: "#f2f3ef" },
          open && { borderColor: "#6a9c36" },
        ]}
      >
        <MapPin size={17} color={disabled ? "#b1b6aa" : "#8b9282"} />
        <TextInput
          accessibilityLabel={label}
          placeholder={placeholder}
          placeholderTextColor="#989e91"
          value={query}
          editable={!disabled}
          onFocus={() => setOpen(true)}
          onChangeText={(text) => {
            setQuery(text);
            onSelect(null);
            setOpen(true);
          }}
          style={[s.searchInput, { fontSize: 16 }]}
        />
        <Pressable
          role="button"
          disabled={disabled}
          accessibilityLabel={`Відкрити список: ${label}`}
          onPress={() => setOpen(!open)}
          style={{
            width: target,
            height: target,
            alignItems: "center",
            justifyContent: "center",
            marginRight: -10,
          }}
        >
          {value && !open ? (
            <Check size={size(18)} color="#57951f" />
          ) : (
            <ChevronDown size={size(18)} color="#818a77" />
          )}
        </Pressable>
      </View>
      {open && !disabled && (
        <View style={s.results}>
          {loading ? (
            <View style={s.resultMessage}>
              <ActivityIndicator size="small" color="#57951f" />
              <Text style={s.hint}>Шукаємо в Новій пошті…</Text>
            </View>
          ) : error ? (
            <View style={{ padding: 14, gap: 8 }}>
              <Text role="alert" style={s.error}>
                {error}
              </Text>
              <Pressable
                role="button"
                onPress={() => setRetry(retry + 1)}
                style={{ minHeight: target, justifyContent: "center" }}
              >
                <Text style={{ fontFamily: "Inter", color: "#57951f" }}>
                  Спробувати ще раз
                </Text>
              </Pressable>
            </View>
          ) : items.length ? (
            <ScrollView
              style={{ maxHeight: 185 }}
              keyboardShouldPersistTaps="handled"
            >
              {items.map((item) => (
                <Pressable
                  key={item.ref}
                  role="button"
                  accessibilityLabel={item.name}
                  onPress={() => choose(item)}
                  style={({ hovered }) => [
                    s.option,
                    { minHeight: target, padding: size(12) },
                    hovered && { backgroundColor: "#eef5e7" },
                  ]}
                >
                  <Text style={s.optionTitle}>{item.name}</Text>
                  {item.detail && <Text style={s.hint}>{item.detail}</Text>}
                </Pressable>
              ))}
            </ScrollView>
          ) : (
            <Text style={[s.hint, { padding: 14 }]}>
              {query.trim().length < 2 && !endpoint.includes("warehouses")
                ? "Введіть щонайменше 2 літери назви міста."
                : "Нічого не знайдено. Спробуйте іншу назву або номер."}
            </Text>
          )}
        </View>
      )}
      {disabled && (
        <Text style={[s.hint, { marginTop: 6 }]}>
          Список з’явиться після вибору міста.
        </Text>
      )}
    </View>
  );
}
function Field({ label, icon: Icon, ...props }) {
  return (
    <View style={{ flex: 1, minWidth: 0 }}>
      <Text style={s.label}>{label}</Text>
      <View dataSet={{ checkoutField: "true" }} style={s.searchBox}>
        {Icon && <Icon size={17} color="#8b9282" />}
        <TextInput
          accessibilityLabel={label}
          placeholderTextColor="#989e91"
          style={[s.searchInput, { fontSize: 16 }]}
          {...props}
        />
      </View>
    </View>
  );
}
export default function Checkout({ telegramOrder = false }) {
  const { width } = useWindowDimensions(),
    mobile = width < 600;
  const formScroll = useRef(null),
    contentPadding = width < 700 ? 25 : 38;
  const paymentAttempt = useRef(null),
    paymentLock = useRef(false),
    sessionReady = useRef(null);
  const [paying, setPaying] = useState(false),
    [paymentMethod, setPaymentMethod] = useState(
      telegramOrder ? "cod" : "online",
    ),
    [confirmed, setConfirmed] = useState(null);
  useEffect(() => {
    if (telegramOrder) return;
    sessionReady.current = fetch("/api/payments/config")
      .then((response) => response.ok)
      .catch(() => false);
  }, [telegramOrder]);
  async function pay() {
    if (telegramOrder || paymentLock.current) return;
    paymentLock.current = true;
    setPaying(true);
    setError("");
    try {
      if (!(await sessionReady.current))
        throw new Error(
          "Не вдалося підключитися до магазину. Оновіть сторінку та повторіть спробу.",
        );
      const order = {
        quantity,
        first,
        last,
        phone,
        city,
        warehouse,
        contactRequested,
        paymentMethod,
      };
      const fingerprint = JSON.stringify(order);
      if (paymentAttempt.current?.fingerprint !== fingerprint)
        paymentAttempt.current = {
          fingerprint,
          requestId: crypto.randomUUID(),
        };
      const response = await fetch(
        paymentMethod === "cod" ? "/api/payments/cod" : "/api/payments/create",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            requestId: paymentAttempt.current.requestId,
            order,
          }),
        },
      );
      const result = await response.json();
      if (!response.ok)
        throw new Error(result.error || "Не вдалося відкрити оплату.");
      if (paymentMethod === "cod") {
        setConfirmed(result);
        setReview(true);
        formScroll.current?.scrollTo({ y: 0, animated: false });
        return;
      }
      const destination = new URL(result.pageUrl);
      if (
        destination.username ||
        destination.password ||
        destination.protocol !== "https:" ||
        !["pay.mbnk.biz", "pay.monobank.ua"].includes(destination.hostname)
      )
        throw new Error("Некоректне посилання оплати.");
      window.location.assign(destination.href);
    } catch (e) {
      setError(
        e.message === "Failed to fetch"
          ? "Перевірте з’єднання та спробуйте ще раз."
          : e.message,
      );
    } finally {
      paymentLock.current = false;
      setPaying(false);
    }
  }
  const { size, target } = useControlScale();
  const [first, setFirst] = useState(""),
    [last, setLast] = useState(""),
    [phone, setPhone] = useState("+380"),
    [quantity, setQuantity] = useState(1),
    [city, setCity] = useState(null),
    [warehouse, setWarehouse] = useState(null),
    [error, setError] = useState(""),
    [review, setReview] = useState(false),
    [contactRequested, setContactRequested] = useState(false),
    [copyStatus, setCopyStatus] = useState("");
  const draft =
    telegramOrder && review
      ? buildTelegramOrder(
          {
            first,
            last,
            phone,
            quantity,
            city,
            warehouse,
            contactRequested,
          },
          UNIT_PRICE,
        )
      : "";
  useEffect(() => {
    setCopyStatus("");
  }, [draft]);
  async function copyOrder() {
    try {
      await navigator.clipboard.writeText(draft);
      setCopyStatus(
        "Скопійовано. Вставте текст у чат продавця та натисніть «Надіслати».",
      );
    } catch {
      setCopyStatus("Виділіть і скопіюйте текст замовлення вище вручну.");
    }
  }
  const selectCity = (item) => {
    setCity(item);
    setWarehouse(null);
    setReview(false);
  };
  function validate() {
    const digits = phone.replace(/\D/g, "");
    if (
      !first.trim() ||
      !last.trim() ||
      first.length > 80 ||
      last.length > 80
    ) {
      setError("Вкажіть ім’я та прізвище отримувача.");
      return;
    }
    if (!/^(?:380\d{9}|0\d{9})$/.test(digits)) {
      setError("Вкажіть український номер телефону: +380 та 9 цифр.");
      return;
    }
    if (!city?.name?.trim() || !warehouse?.name?.trim()) {
      setError(
        telegramOrder
          ? "Вкажіть місто та номер або адресу відділення Нової пошти."
          : "Оберіть місто та відділення зі списків Нової пошти.",
      );
      return;
    }
    setError("");
    if (telegramOrder) {
      setReview(true);
      formScroll.current?.scrollTo({ y: 0, animated: false });
      return;
    }
    pay();
  }
  return (
    <View style={{ flexShrink: 1, minHeight: 0 }}>
      <ScrollView
        ref={formScroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        style={{ minHeight: 0, overscrollBehavior: "contain" }}
        contentContainerStyle={{ padding: contentPadding, paddingBottom: 6 }}
      >
        <Text style={s.eyebrow}>МАГНІТНІ ШАХИ</Text>
        <Text
          role="heading"
          aria-level={2}
          style={[s.title, { fontSize: mobile ? 28 : 33 }]}
        >
          {confirmed
            ? "Замовлення підтверджено"
            : telegramOrder && review
              ? "Перевірте замовлення"
              : "Ще крок до гри."}
        </Text>
        <Text style={s.subtitle}>
          {confirmed
            ? `№ ${confirmed.orderNumber} · Оплата при отриманні`
            : telegramOrder
              ? "Оберіть кількість, заповніть контакти та дані доставки."
              : "Залиште контакти, а ми підготуємо вашу гру до нових пригод."}
        </Text>
        {telegramOrder && (
          <View style={s.availabilityNotice}>
            <Text style={s.availabilityTitle}>Замовлення через Telegram</Text>
            <Text style={s.hint}>
              Перевірте дані та перейдіть у особистий чат продавця. Натисніть
              «Надіслати» в Telegram — після цього продавець зможе підтвердити
              замовлення. Оплата на сайті не проводиться.
            </Text>
          </View>
        )}
        <View style={[s.product, mobile && { flexWrap: "wrap" }]}>
          <Image
            source={{ uri: assetUrl("/assets/checkout-product.webp") }}
            accessibilityLabel="Магнітні Шахи — набір для гри"
            resizeMode="cover"
            style={s.productImage}
          />
          <View style={{ flex: 1, gap: 5, minWidth: 100 }}>
            <Text style={s.productName}>Магнітні Шахи</Text>
            <Text style={s.hint}>Набір для гри · {quantity} шт.</Text>
            <Text style={s.productPrice}>{formatPrice(UNIT_PRICE)} / шт.</Text>
          </View>
          <View style={[s.quantity, mobile && { marginLeft: "auto" }]}>
            <Pressable
              role="button"
              accessibilityLabel="Зменшити кількість"
              disabled={quantity === 1 || review || paying}
              onPress={() => setQuantity(quantity - 1)}
              style={[
                s.qtyButton,
                { width: target, height: target },
                (quantity === 1 || review) && { opacity: 0.35 },
              ]}
            >
              <Minus size={size(15)} />
            </Pressable>
            <Text style={[s.qtyText, { fontSize: size(14) }]}>{quantity}</Text>
            <Pressable
              role="button"
              accessibilityLabel="Збільшити кількість"
              disabled={quantity === 10 || review || paying}
              onPress={() => setQuantity(quantity + 1)}
              style={[
                s.qtyButton,
                { width: target, height: target },
                (quantity === 10 || review) && { opacity: 0.35 },
              ]}
            >
              <Plus size={size(15)} />
            </Pressable>
          </View>
        </View>
        {review ? (
          <View style={s.review}>
            <View style={s.sectionHead}>
              <Text style={s.step}>✓</Text>
              <Text style={s.sectionTitle}>Дані отримувача</Text>
            </View>
            <Text style={s.reviewText}>
              {first.trim()} {last.trim()}
            </Text>
            <Text style={s.reviewText}>{phone}</Text>
            <View style={[s.divider, { marginVertical: 16 }]} />
            <Text style={s.reviewText}>Нова пошта · {city.name}</Text>
            <Text style={[s.hint, { lineHeight: 21, marginTop: 6 }]}>
              {warehouse.name}
            </Text>
            {contactRequested && (
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 8,
                  marginTop: 16,
                }}
              >
                <Phone size={15} color="#57882b" />
                <Text style={s.contactChoiceTitle}>Свʼяжіться зі мною</Text>
              </View>
            )}
            {!confirmed && (
              <Pressable
                role="button"
                onPress={() => setReview(false)}
                style={[s.edit, { minHeight: target, gap: size(6) }]}
              >
                <Pencil size={size(14)} color="#57882b" />
                <Text
                  style={{
                    fontFamily: "Inter",
                    fontSize: size(14),
                    color: "#57882b",
                  }}
                >
                  Редагувати дані
                </Text>
              </Pressable>
            )}
          </View>
        ) : (
          <>
            <View style={s.sectionHead}>
              <Text style={s.step}>1</Text>
              <Text style={s.sectionTitle}>Ваші контакти</Text>
            </View>
            <View
              style={{
                flexDirection: mobile ? "column" : "row",
                gap: 14,
                marginBottom: 15,
              }}
            >
              <Field
                editable={!paying}
                label="Ім’я"
                icon={UserRound}
                maxLength={80}
                value={first}
                onChangeText={setFirst}
                placeholder="Ваше ім’я"
                autoComplete="given-name"
              />
              <Field
                editable={!paying}
                label="Прізвище"
                maxLength={80}
                value={last}
                onChangeText={setLast}
                placeholder="Ваше прізвище"
                autoComplete="family-name"
              />
            </View>
            <Field
              editable={!paying}
              label="Номер телефону"
              icon={Phone}
              value={phone}
              onChangeText={(value) => setPhone(formatPhone(value))}
              placeholder="+380 (67) 123-45-67"
              inputMode="tel"
              autoComplete="tel"
              autoCorrect={false}
            />
            <View style={[s.sectionHead, { marginTop: 27 }]}>
              <Text style={s.step}>2</Text>
              <Text style={s.sectionTitle}>Куди доставити?</Text>
            </View>
            <View style={s.carrier}>
              <View style={s.carrierIcon}>
                <Image
                  source={{ uri: assetUrl("/assets/nova-poshta-mark.svg") }}
                  accessibilityLabel="Знак Нової пошти — Н зі стрілками"
                  resizeMode="contain"
                  style={{ width: 25, height: 25 }}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.carrierTitle}>Нова пошта</Text>
                <Text style={s.hint}>У відділення або поштомат</Text>
              </View>
              <View style={s.selectedRadio}>
                <View style={s.radioDot} />
              </View>
            </View>
            {telegramOrder ? (
              <View style={{ gap: 16, marginBottom: 18 }}>
                <Field
                  label="Місто або населений пункт"
                  icon={MapPin}
                  placeholder="Наприклад, Київ"
                  value={city?.name || ""}
                  onChangeText={(name) => selectCity({ name })}
                  maxLength={120}
                  autoComplete="address-level2"
                />
                <Field
                  label="Відділення або поштомат"
                  icon={MapPin}
                  placeholder="Номер або адреса відділення"
                  value={warehouse?.name || ""}
                  onChangeText={(name) => setWarehouse({ name })}
                  maxLength={200}
                />
                <Text style={s.hint}>
                  Вкажіть населений пункт і номер або повну адресу відділення.
                  Продавець уточнить доставку в Telegram.
                </Text>
              </View>
            ) : (
              <>
                <SearchField
                  label="Місто або населений пункт"
                  placeholder="Почніть вводити назву міста"
                  value={city}
                  onSelect={selectCity}
                  endpoint="/api/delivery/cities"
                  disabled={paying}
                />
                <SearchField
                  label="Відділення або поштомат"
                  placeholder="Номер або адреса відділення"
                  value={warehouse}
                  onSelect={setWarehouse}
                  endpoint={`/api/delivery/warehouses?city=${encodeURIComponent(city?.ref || "")}`}
                  disabled={!city || paying}
                  resetKey={city?.ref}
                />
              </>
            )}
            <Pressable
              role="checkbox"
              disabled={paying}
              accessibilityLabel="Свʼяжіться зі мною"
              aria-checked={contactRequested}
              onKeyDown={(event) => {
                if (event.key === " " || event.key === "Spacebar") {
                  event.preventDefault();
                  if (!paying && !event.repeat)
                    setContactRequested((value) => !value);
                }
              }}
              onPress={() => setContactRequested((value) => !value)}
              style={({ hovered }) => [
                s.contactChoice,
                { minHeight: target, gap: size(12) },
                hovered && { backgroundColor: "#f3f7ed" },
              ]}
            >
              <View style={[s.checkbox, contactRequested && s.checkboxChecked]}>
                {contactRequested && (
                  <Check size={15} color="white" strokeWidth={3} />
                )}
              </View>
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={s.contactChoiceTitle}>Свʼяжіться зі мною</Text>
                <Text style={s.hint}>
                  Зателефонуйте мені для уточнення замовлення
                </Text>
              </View>
            </Pressable>
          </>
        )}
        {telegramOrder && review && (
          <View style={[s.availabilityNotice, { marginTop: 18 }]}>
            <Text style={s.availabilityTitle}>Повідомлення для продавця</Text>
            <Text style={s.hint}>
              Одержувач: @chabaniuk_vladyslav. Якщо Telegram не підставить
              текст, скопіюйте його тут і вставте в чат.
            </Text>
            <TextInput
              accessibilityLabel="Текст замовлення для Telegram"
              multiline
              editable={false}
              value={draft}
              style={{
                fontFamily: "Inter",
                fontSize: 14,
                lineHeight: 21,
                minHeight: 210,
                maxHeight: 300,
                padding: 12,
                borderRadius: 8,
                backgroundColor: "#fffefa",
                color: "#292731",
              }}
            />
            <Pressable
              role="button"
              onPress={copyOrder}
              style={[s.edit, { minHeight: target }]}
            >
              <Text
                style={{ fontFamily: "Inter", color: "#477f17", fontSize: 15 }}
              >
                Скопіювати замовлення
              </Text>
            </Pressable>
            {!!copyStatus && (
              <Text role="status" style={s.hint}>
                {copyStatus}
              </Text>
            )}
          </View>
        )}
        {!confirmed && (
          <View
            role="radiogroup"
            accessibilityLabel="Спосіб оплати"
            style={s.paymentChoices}
          >
            <View style={s.sectionHead}>
              <Text style={s.step}>3</Text>
              <Text style={s.sectionTitle}>Спосіб оплати</Text>
            </View>
            {(telegramOrder ? ["cod"] : ["online", "cod"]).map((method) => (
              <Pressable
                key={method}
                role="radio"
                aria-checked={paymentMethod === method}
                accessibilityLabel={
                  method === "online"
                    ? "Онлайн-оплата"
                    : "При отриманні — 2% + 20 ₴"
                }
                disabled={paying}
                onPress={() => {
                  setPaymentMethod(method);
                  setError("");
                }}
                onKeyDown={(event) => {
                  if (
                    [
                      "ArrowDown",
                      "ArrowUp",
                      "ArrowLeft",
                      "ArrowRight",
                      " ",
                    ].includes(event.key)
                  ) {
                    event.preventDefault();
                    if (!paying && !telegramOrder)
                      setPaymentMethod(
                        event.key === " "
                          ? method
                          : method === "online"
                            ? "cod"
                            : "online",
                      );
                  }
                }}
                style={({ hovered }) => [
                  s.paymentChoice,
                  paymentMethod === method && s.paymentChoiceSelected,
                  hovered && { backgroundColor: "#f3f7ee" },
                ]}
              >
                <View
                  style={[
                    s.paymentRadio,
                    paymentMethod === method && { borderColor: "#6b973c" },
                  ]}
                >
                  {paymentMethod === method && <View style={s.radioDot} />}
                </View>
                <View style={{ flex: 1, minWidth: 0, gap: 10 }}>
                  <Text style={s.carrierTitle}>
                    {method === "online" ? "Онлайн-оплата" : "При отриманні"}
                  </Text>
                  {method === "online" ? (
                    <View style={[s.paymentWallets, mobile && { gap: 12 }]}>
                      <Image
                        source={{ uri: assetUrl("/assets/plata-by-mono.svg") }}
                        accessibilityLabel="plata by mono"
                        resizeMode="contain"
                        style={{ width: mobile ? 90 : 112, height: 27 }}
                      />
                      <Image
                        source={{
                          uri: assetUrl("/assets/apple-pay-plain.svg?v=2"),
                        }}
                        accessibilityLabel="Apple Pay"
                        resizeMode="contain"
                        style={{ width: mobile ? 48 : 60, height: 27 }}
                      />
                      <Image
                        source={{
                          uri: assetUrl("/assets/google-pay-plain.svg"),
                        }}
                        accessibilityLabel="Google Pay"
                        resizeMode="contain"
                        style={{ width: mobile ? 52 : 65, height: 27 }}
                      />
                    </View>
                  ) : (
                    <Text style={s.hint}>
                      Комісія за переказ коштів — 2% + 20 ₴
                    </Text>
                  )}
                </View>
              </Pressable>
            ))}
          </View>
        )}
        <View style={s.summary}>
          <View style={s.summaryRow}>
            <Text style={s.summaryLabel}>
              {quantity === 1
                ? "Вартість набору"
                : `Вартість наборів (${quantity} шт.)`}
            </Text>
            <Text style={s.summaryValue}>
              {formatPrice(UNIT_PRICE * quantity)}
            </Text>
          </View>
          <View style={s.summaryRow}>
            <Text style={s.summaryLabel}>Доставка</Text>
            <Text style={s.summaryValue}>За тарифами перевізника</Text>
          </View>
          <View style={s.divider} />
          <View style={s.summaryRow}>
            <Text style={s.summaryLabel}>Оплата</Text>
            <Text style={s.summaryValue}>
              {paymentMethod === "cod" ? "При отриманні" : "Онлайн карткою"}
            </Text>
          </View>
          {paymentMethod === "cod" && (
            <>
              <View style={s.summaryRow}>
                <Text style={s.summaryLabel}>
                  Комісія за переказ (2% + 20 ₴)
                </Text>
                <Text style={s.summaryValue}>
                  {formatPrice(
                    confirmed
                      ? confirmed.codFee / 100
                      : UNIT_PRICE * quantity * 0.02 + 20,
                  )}
                </Text>
              </View>
              <View style={s.divider} />
              <View style={s.summaryRow}>
                <Text style={[s.summaryValue, { fontWeight: "700" }]}>
                  До сплати при отриманні
                </Text>
                <Text style={[s.summaryValue, { fontWeight: "700" }]}>
                  {formatPrice(
                    confirmed
                      ? confirmed.totalDue / 100
                      : UNIT_PRICE * quantity * 1.02 + 20,
                  )}
                </Text>
              </View>
              <Text style={s.hint}>
                Доставка оплачується окремо за тарифами перевізника.
              </Text>
            </>
          )}
        </View>
      </ScrollView>
      <View
        style={{
          flexShrink: 0,
          paddingHorizontal: contentPadding,
          paddingTop: 16,
          paddingBottom: width < 700 ? 20 : 24,
          backgroundColor: "#fffefa",
          borderTopWidth: 1,
          borderColor: "#edf0e6",
        }}
      >
        {error && (
          <Text role="alert" style={[s.error, { marginBottom: 12 }]}>
            {error}
          </Text>
        )}
        {confirmed ? (
          <View style={s.confirmation}>
            <View style={s.confirmationIcon}>
              <Check size={22} color="#57951f" />
            </View>
            <Text style={s.confirmationText}>
              Замовлення збережено. Оплатіть товар і комісію при отриманні у
              Новій пошті.
            </Text>
          </View>
        ) : (
          <>
            <Pressable
              role={telegramOrder && review ? "link" : "button"}
              href={
                telegramOrder && review ? telegramOrderUrl(draft) : undefined
              }
              hrefAttrs={
                telegramOrder && review
                  ? { target: "_blank", rel: "noopener noreferrer" }
                  : undefined
              }
              disabled={paying}
              accessibilityState={{
                disabled: paying,
                busy: paying,
              }}
              onPress={telegramOrder && review ? undefined : validate}
              style={({ hovered }) => [
                s.submit,
                {
                  minHeight: target,
                  paddingVertical: size(15),
                  paddingHorizontal: size(16),
                  gap: size(12),
                  opacity: paying ? 0.65 : 1,
                },
                hovered && { backgroundColor: "#477f17" },
              ]}
            >
              {paying ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Text
                    style={[
                      s.submitText,
                      {
                        fontSize: size(15),
                        lineHeight: size(20),
                        flexShrink: 1,
                        textAlign: "center",
                      },
                    ]}
                  >
                    {telegramOrder
                      ? review
                        ? "Перейти в Telegram"
                        : "Перевірити замовлення"
                      : paymentMethod === "cod"
                        ? "Підтвердити замовлення"
                        : "Перейти до оплати"}
                  </Text>
                  <ArrowRight size={size(18)} color="white" />
                </>
              )}
            </Pressable>
            <View style={s.privacy}>
              <ShieldCheck size={14} color="#8a9380" />
              <Text style={s.privacyText}>
                {telegramOrder
                  ? "Натисніть «Надіслати» в Telegram. Перехід у чат не надсилає замовлення."
                  : paymentMethod === "cod"
                    ? "Без передоплати · Оплата при отриманні"
                    : "Безпечна оплата через mono"}
              </Text>
            </View>
          </>
        )}
      </View>
    </View>
  );
}
const s = StyleSheet.create({
  availabilityNotice: {
    gap: 6,
    padding: 14,
    marginBottom: 20,
    borderRadius: 12,
    backgroundColor: "#f1f5e9",
    borderWidth: 1,
    borderColor: "#dce6cd",
  },
  availabilityTitle: {
    fontFamily: "Inter",
    fontSize: 13,
    fontWeight: "600",
    color: "#53673d",
  },
  paymentChoices: { marginTop: 8, marginBottom: 22, gap: 10 },
  paymentChoice: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 17,
    borderWidth: 1,
    borderColor: "#e0e7d7",
    borderRadius: 14,
    backgroundColor: "#fffefa",
  },
  paymentChoiceSelected: { borderColor: "#9cbd7b", backgroundColor: "#f8fbf4" },
  paymentRadio: {
    width: 19,
    height: 19,
    borderWidth: 1.5,
    borderColor: "#b8c6a9",
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  paymentWallets: {
    flexDirection: "row",
    alignItems: "center",
    gap: 17,
    flexWrap: "wrap",
  },
  confirmation: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 8,
  },
  confirmationIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#eff5e8",
  },
  confirmationText: {
    flex: 1,
    fontFamily: "Inter",
    fontSize: 13,
    lineHeight: 20,
    color: "#505b45",
  },
  productPrice: {
    fontFamily: "Inter",
    fontSize: 15,
    fontWeight: "700",
    color: "#57951f",
  },
  contactChoice: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 8,
    marginBottom: 17,
    borderRadius: 10,
  },
  checkbox: {
    width: 21,
    height: 21,
    borderWidth: 1.5,
    borderColor: "#b8c6a9",
    borderRadius: 5,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxChecked: { backgroundColor: "#57951f", borderColor: "#57951f" },
  contactChoiceTitle: {
    fontFamily: "Inter",
    fontSize: 14,
    fontWeight: "600",
    color: "#424f36",
  },
  eyebrow: {
    fontFamily: "Inter",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 2.5,
    color: "#72904e",
    marginTop: 9,
  },
  title: {
    fontFamily: "Inter",
    fontWeight: "750",
    letterSpacing: -1.2,
    color: "#23272a",
    marginTop: 12,
    lineHeight: 42,
  },
  subtitle: {
    fontFamily: "Inter",
    fontSize: 14,
    lineHeight: 22,
    color: "#808779",
    marginTop: 8,
    maxWidth: 480,
  },
  product: {
    flexDirection: "row",
    alignItems: "center",
    gap: 15,
    padding: 17,
    borderRadius: 18,
    backgroundColor: "#f0f5e9",
    marginTop: 24,
    marginBottom: 25,
  },
  productImage: { width: 57, aspectRatio: 1, borderRadius: 9, flexShrink: 0 },
  productName: {
    fontFamily: "Inter",
    fontSize: 16,
    fontWeight: "650",
    color: "#283023",
  },
  hint: { fontFamily: "Inter", fontSize: 12, color: "#858d7c", lineHeight: 18 },
  quantity: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#dce5cf",
    borderRadius: 10,
    backgroundColor: "#fffefb",
  },
  qtyButton: {
    width: 30,
    height: 35,
    alignItems: "center",
    justifyContent: "center",
  },
  qtyText: {
    fontFamily: "Inter",
    fontSize: 14,
    fontWeight: "600",
    minWidth: 23,
    textAlign: "center",
  },
  sectionHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 18,
  },
  step: {
    fontFamily: "Inter",
    fontSize: 12,
    fontWeight: "600",
    color: "#648a42",
    backgroundColor: "#edf3e7",
    width: 25,
    height: 25,
    lineHeight: 25,
    textAlign: "center",
    borderRadius: 8,
  },
  sectionTitle: {
    fontFamily: "Inter",
    fontSize: 16,
    fontWeight: "650",
    color: "#30382b",
  },
  label: {
    fontFamily: "Inter",
    fontSize: 12,
    fontWeight: "600",
    color: "#5b6354",
    marginBottom: 8,
  },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderColor: "#dfe4d8",
    borderRadius: 11,
    backgroundColor: "#fff",
    paddingHorizontal: 13,
    minHeight: 48,
  },
  searchInput: {
    flex: 1,
    minWidth: 0,
    fontFamily: "Inter",
    fontSize: 16,
    color: "#2c3426",
    outlineStyle: "none",
    paddingVertical: 14,
  },
  carrier: {
    flexDirection: "row",
    alignItems: "center",
    gap: 13,
    borderWidth: 1,
    borderColor: "#b6ce9c",
    borderRadius: 13,
    padding: 13,
    marginBottom: 19,
    backgroundColor: "#fafcf7",
  },
  carrierIcon: {
    width: 38,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
  },
  carrierTitle: {
    fontFamily: "Inter",
    fontSize: 14,
    fontWeight: "650",
    color: "#33392e",
    marginBottom: 2,
  },
  selectedRadio: {
    width: 18,
    height: 18,
    borderWidth: 1.5,
    borderColor: "#6b973c",
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  radioDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#6b973c",
  },
  results: {
    borderWidth: 1,
    borderColor: "#dfe7d4",
    borderRadius: 11,
    marginTop: 6,
    overflow: "hidden",
    backgroundColor: "#fff",
    boxShadow: "0 6px 20px #30451b09",
  },
  option: {
    padding: 12,
    gap: 3,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f3ec",
  },
  optionTitle: {
    fontFamily: "Inter",
    fontSize: 14,
    color: "#30382b",
    lineHeight: 20,
  },
  resultMessage: {
    padding: 16,
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
  },
  summary: {
    backgroundColor: "#f7f8f4",
    padding: 18,
    borderRadius: 13,
    gap: 12,
    marginTop: 3,
    marginBottom: 19,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 16,
  },
  summaryLabel: { fontFamily: "Inter", fontSize: 12, color: "#858b7d" },
  summaryValue: {
    fontFamily: "Inter",
    fontSize: 12,
    fontWeight: "500",
    color: "#505b45",
    flexShrink: 1,
    textAlign: "right",
  },
  divider: { height: 1, backgroundColor: "#e6eadd" },
  submit: {
    backgroundColor: "#57951f",
    borderRadius: 13,
    paddingVertical: 17,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 15,
    transition: "background-color 150ms",
  },
  submitText: {
    fontFamily: "Inter",
    fontSize: 14,
    fontWeight: "600",
    color: "#fff",
  },
  privacy: {
    flexDirection: "row",
    gap: 6,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 13,
  },
  privacyText: { fontFamily: "Inter", fontSize: 10, color: "#909784" },
  error: {
    fontFamily: "Inter",
    fontSize: 12,
    color: "#b24f3b",
    lineHeight: 19,
  },
  review: {
    padding: 19,
    borderWidth: 1,
    borderColor: "#e0e7d7",
    borderRadius: 14,
    marginBottom: 20,
  },
  reviewText: {
    fontFamily: "Inter",
    fontSize: 15,
    color: "#3e4834",
    lineHeight: 25,
  },
  edit: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 19 },
});
