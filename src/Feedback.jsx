import React from "react";
import { View, Text, Pressable, Image, StyleSheet } from "react-native";
import { Mail, Phone } from "lucide-react";

// Fill these with the shop's public contacts when they are provided.
export const feedbackContacts = {
  email: "",
  phone: "",
  telegram: "",
  viber: "",
};

export default function Feedback({ mobile, tablet }) {
  const { email, phone, telegram, viber } = feedbackContacts;
  const items = [
    {
      name: "Електронна пошта",
      value: email || "Адресу буде додано",
      href: email ? `mailto:${email}` : null,
      Icon: Mail,
      color: "#57951f",
    },
    {
      name: "Телефон",
      value: phone || "Номер буде додано",
      href: phone ? `tel:${phone.replace(/[^+\d]/g, "")}` : null,
      Icon: Phone,
      color: "#57951f",
    },
    {
      name: "Telegram",
      value: "Написати повідомлення",
      href: telegram || null,
      image: "/assets/telegram-contact.svg",
      color: "#229ed9",
    },
    {
      name: "Viber",
      value: "Написати повідомлення",
      href: viber
        ? `viber://chat?number=${encodeURIComponent(viber.replace(/\D/g, ""))}`
        : null,
      image: "/assets/viber-contact.svg",
      color: "#7360f2",
    },
  ];
  return (
    <View
      dataSet={{ reveal: "visible" }}
      nativeID="contact"
      style={[
        styles.section,
        {
          paddingHorizontal: mobile ? 28 : 60,
          flexDirection: tablet ? "column" : "row",
          gap: tablet ? 28 : 40,
        },
      ]}
    >
      <View
        style={{
          flex: tablet ? undefined : 1,
          width: tablet ? "100%" : undefined,
        }}
      >
        <Text style={styles.eyebrow}>ЗВОРОТНИЙ ЗВ’ЯЗОК</Text>
        <Text
          role="heading"
          aria-level={2}
          style={[
            styles.heading,
            { fontSize: mobile ? 20 : 27, lineHeight: 40 },
          ]}
        >
          Маєте питання?{"\n"}Ми на зв’язку.
        </Text>
        <Text style={styles.body}>
          Запитайте про гру, доставку чи замовлення. Або поділіться враженнями
          від вашої першої партії!
        </Text>
      </View>
      <View
        style={{
          width: tablet ? "100%" : "46%",
          flexDirection: "row",
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        {items.map(({ name, value, href, Icon, image, color }) => (
          <Pressable
            key={name}
            role="link"
            href={href || undefined}
            disabled={!href}
            accessibilityLabel={name}
            accessibilityState={{ disabled: !href }}
            style={({ hovered }) => [
              styles.card,
              {
                width: mobile ? "100%" : undefined,
                flexBasis: mobile ? "100%" : "calc(50% - 6px)",
                minWidth: 0,
                backgroundColor: hovered && href ? "#e8f1dd" : "#f4f7ef",
              },
            ]}
          >
            <View style={[styles.icon, { backgroundColor: color }]}>
              {Icon ? (
                <Icon size={21} color="white" />
              ) : (
                <Image
                  source={{ uri: image }}
                  style={{ width: 24, height: 24 }}
                  resizeMode="contain"
                />
              )}
            </View>
            <Text style={styles.name}>{name}</Text>
            <Text style={styles.value}>{value}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}
const styles = StyleSheet.create({
  section: {
    paddingVertical: 49,
    alignItems: "center",
    backgroundColor: "#fffefa",
  },
  eyebrow: {
    fontFamily: "Inter",
    fontSize: 12,
    fontWeight: "750",
    letterSpacing: 2.7,
    color: "#24232d",
  },
  heading: {
    fontFamily: '"Press Start 2P"',
    color: "#24232d",
    letterSpacing: -1.2,
    marginTop: 14,
  },
  body: {
    fontFamily: "Inter",
    fontSize: 15,
    lineHeight: 25,
    color: "#74776e",
    marginTop: 18,
    maxWidth: 410,
  },
  card: { borderRadius: 18, padding: 18, minHeight: 150 },
  icon: {
    width: 40,
    height: 40,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  name: {
    fontFamily: "Inter",
    fontSize: 15,
    fontWeight: "600",
    color: "#24232d",
  },
  value: {
    fontFamily: "Inter",
    fontSize: 12,
    lineHeight: 19,
    color: "#74776e",
    marginTop: 5,
  },
});
