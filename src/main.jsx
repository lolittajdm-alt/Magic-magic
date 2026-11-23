import { API_AVAILABLE } from "./api.js";
import { useModalViewport } from "./useModalViewport.js";
import { advanceCheckoutField } from "./checkoutFocus.js";
import { assetUrl } from "./assetUrl.js";
import React, { useState, useRef, useLayoutEffect } from "react";
import { createRoot } from "react-dom/client";
import {
  View,
  Text,
  Image,
  Pressable,
  ScrollView,
  Modal,
  StyleSheet,
  useWindowDimensions,
} from "react-native";
import {
  ArrowUpRight,
  ArrowUp,
  ArrowRight,
  ArrowLeft,
  Play,
  X,
  Sparkles,
  ChevronDown,
} from "lucide-react";
import "./styles.css";
import Checkout from "./Checkout.jsx";
import Feedback from "./Feedback.jsx";
import PaymentResult from "./PaymentResult.jsx";
import { useControlScale } from "./useControlScale.js";
import { useReducedMotion, useSectionReveal } from "./useMotion.js";

const green = "#57951f",
  ink = "#24232d";
const projects = [
  {
    title: "Розподіліть магніти",
    category: "КРОК 1",
    image: assetUrl("/assets/rule-1-enhanced.webp"),
    summary: "Розділіть магніти порівну між гравцями.",
    description:
      "Перед початком гри розподіліть усі магнітні кульки порівну. Для гри вдвох із набором із 32 кульок кожен отримує по 16. Ігрове поле на початку порожнє.",
    tags: ["32 магніти", "По 16 для двох"],
  },
  {
    title: "Ставте по черзі",
    category: "КРОК 2",
    image: assetUrl("/assets/rule-2-enhanced.webp"),
    summary: "По черзі ставте по одному магніту у вільну комірку.",
    description:
      "Гравці ходять по черзі: за один хід поставте одну свою магнітну кульку в будь-яку вільну комірку. Обирайте місце уважно, щоб магніти не притягнулися один до одного.",
    tags: ["Один хід — один магніт", "Вільна комірка"],
  },
  {
    title: "Уникайте злипання",
    category: "КРОК 3",
    image: assetUrl("/assets/rule-3-enhanced.webp"),
    summary: "Магніти злиплися під час вашого ходу? Заберіть їх собі.",
    description:
      "Якщо під час вашого ходу магніти злиплися, заберіть усі злиплі кульки собі. Тепер їх теж потрібно буде розмістити на полі. Далі хід переходить до наступного гравця.",
    tags: ["Злиплі магніти — до себе", "Гра продовжується"],
  },
  {
    title: "Перемагайте!",
    category: "КРОК 4",
    image: assetUrl("/assets/rule-4-enhanced.webp"),
    summary: "Першим позбудьтеся всіх своїх магнітів — і ви перемогли!",
    description:
      "Перемагає той, хто першим позбудеться всіх своїх магнітів. Ставте кульки обережно, продумуйте кожен хід і стежте за полем до самого кінця партії.",
    tags: ["Жодного магніту в запасі", "Перемога!"],
  },
];
function Crop({ rect, style, label }) {
  const [width, setWidth] = useState(0);
  const [x, y, w, h] = rect;
  const scale = width / w;
  return (
    <View
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      style={[{ overflow: "hidden", aspectRatio: w / h }, style]}
      accessibilityLabel={label}
      role="img"
    >
      <Image
        accessible={false}
        source={{ uri: assetUrl("/assets/reference.webp") }}
        style={{
          position: "absolute",
          width: 1024 * scale,
          height: 1536 * scale,
          left: -x * scale,
          top: -y * scale,
        }}
      />
    </View>
  );
}
function RuleImage({ index, label, style }) {
  return (
    <Image
      source={{ uri: projects[index].image }}
      accessibilityLabel={label}
      resizeMode="cover"
      style={[{ width: "100%", aspectRatio: 4 / 3, borderRadius: 21 }, style]}
    />
  );
}
function Button({
  children,
  onPress,
  secondary = false,
  style,
  icon = true,
  nativeID,
  compact = false,
}) {
  const { size, target } = useControlScale();
  return (
    <Pressable
      nativeID={nativeID}
      role="button"
      onPress={onPress}
      style={({ hovered, pressed }) => [
        s.button,
        {
          minHeight: target,
          paddingVertical: size(compact ? 12 : 15),
          paddingHorizontal: size(compact ? 20 : 23),
          borderRadius: size(28),
          gap: size(12),
          flexShrink: 0,
        },
        secondary ? s.secondary : { backgroundColor: green },
        hovered && {
          transform: [{ translateY: -2 }],
          backgroundColor: secondary ? "#f0f6e9" : "#477e16",
        },
        pressed && { opacity: 0.8 },
        style,
      ]}
    >
      <Text
        style={[
          s.buttonText,
          { fontSize: size(15), lineHeight: size(20) },
          secondary && { color: ink },
        ]}
      >
        {children}
      </Text>
      {icon && <ArrowRight size={size(18)} color={secondary ? ink : "white"} />}
    </Pressable>
  );
}
function App() {
  const { width } = useWindowDimensions(),
    mobile = width < 700,
    tablet = width < 1100;
  const reducedMotion = useReducedMotion();
  useSectionReveal(reducedMotion);
  const { size, target } = useControlScale();
  const circleStyle = [
    s.circle,
    { width: target, height: target, borderRadius: target / 2, flexShrink: 0 },
  ];
  const linkStyle = [s.textLink, { minHeight: target, gap: size(12) }];
  const [selected, setSelected] = useState(null),
    [aboutMore, setAboutMore] = useState(false),
    [activeNote, setActiveNote] = useState(null),
    [contact, setContact] = useState(false);
  const gallery = useRef(null),
    [galleryWidth, setGalleryWidth] = useState(0),
    position = useRef(0);
  const closeButton = useRef(null);
  const go = (id) => {
    document.getElementById(id)?.scrollIntoView({
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "instant"
        : "smooth",
      block: "start",
    });
    history.replaceState(null, "", "#" + id);
  };
  const modal = selected !== null || activeNote !== null || contact;
  const close = () => {
    setSelected(null);
    setActiveNote(null);
    setContact(false);
  };
  useLayoutEffect(() => {
    if (!modal) return;
    const handler = (e) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [modal]);
  useModalViewport(modal);
  const notes = [
    {
      title: "Світ починається з одного блоку",
      label: "ПРОЦЕС",
      body: "Спершу — силует. До деталей варто переходити тоді, коли основні об’єми вже розповідають історію. Спробуйте побудувати сцену лише з трьох матеріалів: це допомагає зосередитися на формі.",
    },
    {
      title: "Як знайти свою палітру",
      label: "НАТХНЕННЯ",
      body: "Оберіть один головний колір, один допоміжний і невеликий яскравий акцент. Природа — найкраще джерело поєднань: зелень трави, тепле дерево й блакить неба вже створюють цілісний світ.",
    },
    {
      title: "Магія маленьких деталей",
      label: "НОТАТКИ",
      body: "Ліхтар біля дверей, квітка на підвіконні, стежка до води. Саме ці речі підказують, що у вашому світі є життя. Додайте три деталі, які розкажуть історію без слів.",
    },
  ];
  return (
    <View style={s.page}>
      <View
        style={[
          s.shell,
          {
            marginTop: mobile ? 16 : 56,
            marginBottom: mobile ? 16 : 48,
            width: width < 1200 ? "94%" : width < 1600 ? "86%" : "70%",
          },
        ]}
      >
        <View nativeID="home" style={[s.hero, { minHeight: mobile ? 0 : 700 }]}>
          <Image
            source={{ uri: assetUrl("/assets/hero-meadow.webp") }}
            style={[
              s.heroImage,
              tablet && !mobile && { width: 1160, right: -40 },
              mobile && {
                width: "210%",
                height: "calc(100% - 360px)",
                top: 360,
                right: -110,
              },
            ]}
            resizeMode="cover"
          />
          <View
            style={[
              s.heroFade,
              tablet &&
                !mobile && {
                  backgroundImage:
                    "linear-gradient(90deg,#fffefa 0%,#fffefaef 40%,#fffefa80 55%,transparent 72%)",
                },
              mobile && s.heroFadeMobile,
            ]}
          />
          <Image
            source={{ uri: assetUrl("/assets/hero-bird.webp") }}
            accessibilityLabel="Синьо-жовта пташка в польоті"
            pointerEvents="none"
            resizeMode="contain"
            style={{
              position: "absolute",
              top: mobile ? 96 : 100,
              left: mobile ? undefined : "43%",
              right: mobile ? 16 : undefined,
              width: mobile ? 76 : 180,
              height: mobile ? 55 : 130,
            }}
          />
          <View
            style={[
              s.nav,
              { paddingHorizontal: mobile ? 16 : 48, gap: mobile ? 12 : 20 },
            ]}
          >
            <Pressable
              role="button"
              onPress={() => go("home")}
              accessibilityLabel="Магнітні Шахи — на головну"
              style={[
                s.brand,
                { minHeight: target, gap: mobile ? 7 : size(10) },
              ]}
            >
              <Image
                source={{ uri: assetUrl("/favicon.svg") }}
                style={{
                  width: mobile ? 26 : size(32),
                  height: mobile ? 29 : size(35),
                }}
              />
              <Text
                style={[
                  s.brandText,
                  { fontSize: mobile ? (width < 360 ? 15 : 17) : size(25) },
                  mobile && { letterSpacing: -0.5 },
                ]}
              >
                Магнітні Шахи
              </Text>
            </Pressable>
            <Button
              nativeID="order-button"
              onPress={() => setContact(true)}
              compact
              style={mobile ? { paddingHorizontal: 14 } : undefined}
              icon={!mobile}
            >
              Замовити
            </Button>
          </View>
          <View
            style={[
              s.heroCopy,
              {
                paddingHorizontal: mobile ? 25 : 64,
                paddingTop: mobile ? 28 : 24,
              },
            ]}
          >
            <Text
              role="heading"
              aria-level={1}
              style={[
                s.heading,
                {
                  fontSize: mobile
                    ? Math.min(28, (width * 0.94 - 50) / 10.5)
                    : tablet
                      ? Math.min(34, (width * 0.94 * 0.54 - 88) / 11)
                      : 43,
                  lineHeight: mobile ? 40 : tablet ? 48 : 60,
                  maxWidth: mobile
                    ? "100%"
                    : tablet
                      ? width * 0.94 * 0.54 - 88
                      : "52%",
                  marginTop: 0,
                },
              ]}
            >
              Грай.
              <Text>
                {"\n"}Притримуйся{"\n"}стратегії.
              </Text>
              <Text style={{ color: green }}>{"\n"}Перемагай.</Text>
            </Text>
            <Text
              style={[
                s.body,
                {
                  maxWidth:
                    tablet && !mobile
                      ? Math.min(380, width * 0.94 * 0.54 - 88)
                      : 380,
                  marginTop: 22,
                  fontSize: mobile ? 16 : 18,
                  lineHeight: 28,
                },
              ]}
            >
              Магнітні Шахи — це захоплива логічна гра з магнітними кульками,
              яка тренує мислення, уважність і стратегічні навички. Гра виконана
              з натурального дерева та підходить як для дітей, так і для
              дорослих.
            </Text>
            <View
              style={[
                s.heroActions,
                { gap: mobile ? 14 : size(24), flexWrap: "wrap" },
              ]}
            >
              <Button onPress={() => go("projects")}>Детальніше</Button>
              <Pressable
                role="button"
                onPress={() => {
                  setActiveNote({
                    title: "Reel ще створюється",
                    body: "Нові світи вже набувають форми. А поки відео готується — дослідіть добірку проєктів.",
                    reel: true,
                  });
                }}
                style={[s.reel, { minHeight: target, gap: size(10) }]}
              >
                <View
                  style={[
                    s.play,
                    { width: target, height: target, borderRadius: target / 2 },
                  ]}
                >
                  <Play size={size(16)} fill={ink} color={ink} />
                </View>
                <View>
                  <Text
                    style={{
                      fontFamily: "Inter",
                      fontSize: size(15),
                      color: ink,
                    }}
                  >
                    Відео демонстрація
                  </Text>
                </View>
              </Pressable>
            </View>
          </View>
          <View
            nativeID="hero-product-box"
            pointerEvents="none"
            style={{
              position: mobile ? "relative" : "absolute",
              alignSelf: "flex-end",
              right: mobile ? 8 : 12,
              top: mobile ? undefined : 100,
              marginTop: mobile ? 20 : 0,
              marginBottom: mobile ? 72 : 0,
              width: mobile ? "82%" : "46%",
              maxWidth: 510,
              aspectRatio: 1,
            }}
          >
            <img
              className="hero-box-shell"
              src={assetUrl("/assets/magnetic-game-box-refined.webp")}
              alt=""
              aria-hidden="true"
              draggable={false}
            />
            <img
              className="hero-box-front"
              src={assetUrl("/assets/magnetic-box-front-approved.webp")}
              alt="Коробка гри Магнітний бій"
              draggable={false}
            />
          </View>
          <div className="hero-magnets" aria-hidden="true">
            {[
              [8, 25, 24],
              [18, 69, 17],
              [33, 12, 27],
              [36, 40, 20],
              [55, 48, 16],
              [68, 14, 26],
              [72, 32, 22],
              [86, 65, 18],
              [95, 21, 15],
            ].map(([left, bottom, diameter], index) => (
              <span
                key={index}
                className="hero-magnet"
                style={{
                  left: `${left}%`,
                  bottom: `${bottom}%`,
                  "--magnet-size": `${diameter}px`,
                }}
              >
                <img
                  src={assetUrl("/assets/hero-magnet-glossy.webp")}
                  alt=""
                  draggable={false}
                />
              </span>
            ))}
          </div>
          <View style={s.heroBottom} />
        </View>
        <View
          dataSet={{ reveal: "visible" }}
          nativeID="about"
          style={[
            s.about,
            {
              flexDirection: tablet ? "column" : "row",
              paddingHorizontal: mobile ? 25 : 64,
              gap: tablet ? 30 : 60,
            },
          ]}
        >
          <View
            nativeID="about-collage"
            dataSet={{ expanded: aboutMore }}
            style={{
              width: tablet ? "100%" : "49%",
              alignSelf: !tablet ? "stretch" : undefined,
              paddingBottom: 15,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <div
              className="about-photo-pair about-photo-pair-top"
              aria-hidden={!aboutMore}
              inert={!aboutMore}
            >
              <img
                src={projects[0].image}
                alt="Дерев’яне поле з магнітними кульками"
              />
              <img
                src={projects[1].image}
                alt="Розташування магнітів під час гри"
              />
            </div>
            <View style={{ width: "100%", position: "relative", zIndex: 1 }}>
              <Crop
                rect={[94, 580, 435, 254]}
                label="Затишний воксельний будинок та кріпер"
                style={{ width: "100%" }}
              />
              <Image
                source={{ uri: assetUrl("/assets/hero-squirrel.webp") }}
                accessibilityLabel="Білочка з табличкою ЕКО Матеріали на тлі будиночка"
                pointerEvents="none"
                resizeMode="contain"
                style={{
                  position: "absolute",
                  left: "-3%",
                  bottom: "11%",
                  width: "58%",
                  height: "105%",
                }}
              />
            </View>
            <div
              className="about-photo-pair about-photo-pair-bottom"
              aria-hidden={!aboutMore}
              inert={!aboutMore}
            >
              <img
                src={projects[2].image}
                alt="Магнітні кульки притягуються одна до одної"
              />
              <img
                src={projects[3].image}
                alt="Останні магніти перед перемогою"
              />
            </div>
          </View>
          <View
            style={[
              s.aboutCopy,
              {
                borderLeftWidth: tablet ? 0 : 1,
                paddingLeft: tablet ? 0 : 38,
                width: tablet ? "100%" : undefined,
                flex: tablet ? undefined : 1,
                minWidth: 0,
              },
            ]}
          >
            <Text style={s.eyebrow}>ПРО ГРУ</Text>
            <Text
              role="heading"
              aria-level={2}
              style={[
                s.heading,
                { fontSize: mobile ? 25 : 29, lineHeight: 43, marginTop: 16 },
              ]}
            >
              Магнітний{"\n"}бій
            </Text>
            <Text
              style={[
                s.body,
                { marginTop: 19, maxWidth: tablet ? "100%" : 335 },
              ]}
            >
              Маленькі кульки — великі емоції. Збирайтеся за одним столом і
              відкривайте світ магнітних шахів разом.
            </Text>
            <Pressable
              role="button"
              onPress={() => setAboutMore(!aboutMore)}
              accessibilityState={{ expanded: aboutMore }}
              aria-controls="game-details"
              style={linkStyle}
            >
              <Text style={[s.linkText, { fontSize: size(15) }]}>
                {aboutMore ? "Згорнути" : "Дізнатися більше"}
              </Text>
              {aboutMore ? (
                <ChevronDown size={size(18)} />
              ) : (
                <ArrowRight size={size(18)} />
              )}
            </Pressable>
            <div
              id="game-details"
              className="disclosure"
              data-open={aboutMore}
              inert={!aboutMore}
              aria-hidden={!aboutMore}
            >
              <div className="disclosure-inner">
                <View style={[s.gameDetails, tablet && { maxWidth: "100%" }]}>
                  <Text
                    style={[
                      s.body,
                      {
                        marginTop: 20,
                        fontSize: 18,
                        lineHeight: 28,
                        fontWeight: "600",
                      },
                    ]}
                  >
                    Маленькі кульки — великі емоції.
                  </Text>
                  <Text style={[s.body, { marginTop: 10 }]}>
                    Збирайтеся за одним столом і влаштовуйте власний магнітний
                    поєдинок. Тут важливо не лише зробити хід, а й обрати вдале
                    місце: магніти можуть притягнутися один до одного та змінити
                    перебіг гри.
                  </Text>
                  <View
                    style={{
                      flexDirection: "row",
                      flexWrap: "wrap",
                      gap: 8,
                      marginTop: 20,
                    }}
                  >
                    {[
                      "32 магнітні кульки",
                      "Для дітей від 7 років",
                      "Ігрове поле з комірками",
                    ].map((fact) => (
                      <Text
                        key={fact}
                        style={[s.tag, { fontSize: 12, lineHeight: 18 }]}
                      >
                        {fact}
                      </Text>
                    ))}
                  </View>
                  <Text style={[s.body, { marginTop: 20, fontWeight: "700" }]}>
                    Прості правила, захопливі ходи
                  </Text>
                  <Text style={[s.body, { marginTop: 8 }]}>
                    Розподіліть кульки порівну та по черзі ставте їх у вільні
                    комірки. Якщо магніти злиплися під час вашого ходу —
                    заберіть їх собі. Перемагає той, хто першим позбудеться всіх
                    своїх магнітів.
                  </Text>
                  <Text style={[s.body, { marginTop: 14, color: "#67666b" }]}>
                    Грайте з дитиною, друзями або всією родиною. Придивляйтеся
                    до поля, продумуйте наступний крок і насолоджуйтеся часом
                    разом — без екранів, зате з живими емоціями.
                  </Text>

                  <Text style={[s.body, { fontWeight: "600" }]}>
                    Усе для першої партії
                  </Text>
                  <Text style={[s.body, { marginTop: 9, color: "#67666b" }]}>
                    У квадратній коробці — ігрове поле та 32 магнітні кульки.
                    Правила надруковані на звороті упаковки: їх зручно
                    переглянути перед початком гри.
                  </Text>
                  <Text style={[s.body, { marginTop: 12, color: "#67666b" }]}>
                    Оберіть доставку Новою поштою й зручний спосіб оплати:
                    онлайн або при отриманні.
                  </Text>
                  <Button
                    onPress={() => setContact(true)}
                    style={{ marginTop: 20, alignSelf: "flex-start" }}
                  >
                    Замовити набір
                  </Button>
                </View>
              </div>
            </div>
          </View>
        </View>
        <View
          dataSet={{ reveal: "visible" }}
          nativeID="projects"
          style={[s.projects, { paddingHorizontal: mobile ? 25 : 38 }]}
        >
          <View style={s.sectionLabel}>
            <View style={s.line} />
            <Text
              role="heading"
              aria-level={2}
              style={[
                s.eyebrow,
                { fontSize: mobile ? 13 : 17, letterSpacing: mobile ? 2 : 4 },
              ]}
            >
              ПРАВИЛА ГРИ
            </Text>
            <View style={s.line} />
          </View>
          <View onLayout={(e) => setGalleryWidth(e.nativeEvent.layout.width)}>
            <ScrollView
              ref={gallery}
              horizontal
              showsHorizontalScrollIndicator={false}
              onScroll={(e) => {
                position.current = e.nativeEvent.contentOffset.x;
              }}
              scrollEventThrottle={100}
              style={{ scrollSnapType: mobile ? "x mandatory" : undefined }}
              contentContainerStyle={{
                gap: 18,
                paddingVertical: 10,
                ...(!mobile ? { width: "100%", flexWrap: "wrap" } : {}),
              }}
            >
              {projects.map((p, i) => (
                <Pressable
                  role="button"
                  key={p.title}
                  onPress={() => setSelected(i)}
                  accessibilityLabel={`Відкрити правило: ${p.title}`}
                  style={({ hovered }) => ({
                    width: mobile
                      ? Math.max(210, galleryWidth * 0.88)
                      : tablet
                        ? "calc(50% - 9px)"
                        : "calc(25% - 13.5px)",
                    scrollSnapAlign: "start",
                    transform: [{ translateY: hovered ? -5 : 0 }],
                    transition: "transform 180ms",
                  })}
                >
                  <RuleImage index={i} label={p.title} />
                  <View style={[s.cardCaption, { alignItems: "flex-start" }]}>
                    <View style={{ flex: 1 }}>
                      <Text style={s.category}>{p.category}</Text>
                      <Text
                        style={[s.cardTitle, { marginTop: 6, lineHeight: 22 }]}
                      >
                        {p.title}
                      </Text>
                      <Text
                        style={[
                          s.body,
                          {
                            fontSize: 14,
                            lineHeight: 21,
                            marginTop: 8,
                            color: "#676c61",
                          },
                        ]}
                      >
                        {p.summary}
                      </Text>
                    </View>
                  </View>
                </Pressable>
              ))}
            </ScrollView>
            {mobile && (
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "flex-end",
                  gap: 10,
                  marginTop: 12,
                }}
              >
                <Pressable
                  role="button"
                  accessibilityLabel="Попередні правила"
                  onPress={() =>
                    gallery.current?.scrollTo({
                      x: Math.max(
                        0,
                        position.current - galleryWidth * 0.88 - 18,
                      ),
                      animated: !reducedMotion,
                    })
                  }
                  style={circleStyle}
                >
                  <ArrowLeft size={size(20)} />
                </Pressable>
                <Pressable
                  role="button"
                  accessibilityLabel="Наступні правила"
                  onPress={() =>
                    gallery.current?.scrollTo({
                      x: position.current + galleryWidth * 0.88 + 18,
                      animated: !reducedMotion,
                    })
                  }
                  style={circleStyle}
                >
                  <ArrowRight size={size(20)} />
                </Pressable>
              </View>
            )}
          </View>
        </View>
        <View
          style={[
            s.quote,
            { height: mobile ? 300 : 270, marginTop: mobile ? 25 : 30 },
          ]}
        >
          <Crop
            rect={[390, 1061, 584, 187]}
            label="Панорама кубічного лісу та засніжених гір"
            style={{
              position: "absolute",
              right: 0,
              bottom: 0,
              width: mobile ? "145%" : "76%",
              opacity: mobile ? 0.65 : 1,
            }}
          />
          <View style={s.quoteFade} />
          <View style={{ paddingLeft: mobile ? 30 : 64, paddingTop: 40 }}>
            <Text style={s.quoteMark}>“</Text>
            <Text style={[s.quoteText, { fontSize: mobile ? 25 : 29 }]}>
              Маленькі партії{"\n"}приведуть{"\n"}до великих перемог!
              <Text style={{ color: green }}> —</Text>
            </Text>
          </View>
        </View>
        <View
          dataSet={{ reveal: "visible" }}
          nativeID="journal"
          style={[s.journal, { padding: mobile ? 28 : 60 }]}
        >
          <View style={s.journalTop}>
            <View>
              <Text style={s.eyebrow}>ЗА ЛАШТУНКАМИ</Text>
              <Text
                role="heading"
                aria-level={2}
                style={[
                  s.heading,
                  {
                    fontSize: mobile ? 20 : tablet ? 24 : 28,
                    lineHeight: 40,
                    marginTop: 14,
                  },
                ]}
              >
                Щоденник білдера
              </Text>
            </View>
            <Sparkles size={25} color={green} />
          </View>
          <View
            style={{
              flexDirection: tablet ? "column" : "row",
              gap: 28,
              marginTop: 30,
            }}
          >
            {notes.map((note, i) => (
              <Pressable
                role="button"
                key={note.title}
                onPress={() => setActiveNote(note)}
                style={({ hovered }) => ({
                  flex: 1,
                  paddingTop: 23,
                  borderTopWidth: 1,
                  borderColor: hovered ? green : "#d9ddcf",
                })}
              >
                <Text style={s.category}>{note.label}</Text>
                <Text
                  style={[
                    s.cardTitle,
                    {
                      fontSize: 19,
                      lineHeight: 27,
                      marginTop: 12,
                      minHeight: mobile ? 0 : 54,
                    },
                  ]}
                >
                  {note.title}
                </Text>
                <Text
                  style={[
                    s.body,
                    { fontSize: 14, color: "#74776e", marginTop: 12 },
                  ]}
                  numberOfLines={2}
                >
                  {note.body}
                </Text>
                <View style={[...linkStyle, { marginTop: 16 }]}>
                  <Text style={[s.linkText, { fontSize: size(14) }]}>
                    Читати нотатку
                  </Text>
                  <ArrowUpRight size={size(16)} />
                </View>
              </Pressable>
            ))}
          </View>
        </View>
        <Feedback mobile={mobile} tablet={tablet} />
        <View style={[s.footer, { paddingHorizontal: mobile ? 28 : 60 }]}>
          <Text style={s.footerText}>
            © {new Date().getFullYear()} Магнітні Шахи
          </Text>
          <Text style={s.footerText}>
            Створено з любов’ю. Для дорослих та дітей.
          </Text>
          <Pressable
            role="button"
            onPress={() => go("home")}
            accessibilityLabel="Повернутися нагору"
            style={circleStyle}
          >
            <ArrowUp size={size(20)} color={green} />
          </Pressable>
        </View>
      </View>
      <Modal
        visible={modal}
        transparent
        animationType="none"
        onRequestClose={close}
        onShow={() => closeButton.current?.focus()}
      >
        <View
          nativeID="site-overlay"
          dataSet={{ checkout: contact ? "true" : "false" }}
          style={s.overlay}
        >
          <Pressable
            role="button"
            tabIndex={-1}
            style={StyleSheet.absoluteFill}
            onPress={close}
            accessibilityLabel="Закрити вікно"
          />
          <View
            nativeID="site-viewport"
            dataSet={{ checkout: contact ? "true" : "false" }}
          >
            <View
              dataSet={{ checkout: contact ? "true" : "false" }}
              nativeID="site-dialog"
              role="dialog"
              aria-modal="true"
              accessibilityLabel={
                contact
                  ? "Оформлення замовлення"
                  : selected !== null
                    ? projects[selected].title
                    : activeNote?.title
              }
              style={[
                s.modal,
                {
                  width: mobile ? "100%" : 720,
                  maxWidth: "100%",
                  minHeight: 0,
                  flexShrink: 1,
                },
              ]}
            >
              <View nativeID="dialog-toolbar">
                {contact && (
                  <>
                    <Text nativeID="checkout-toolbar-title">
                      Оформлення замовлення
                    </Text>
                    <button
                      id="keyboard-done"
                      type="button"
                      aria-label="Готово — наступне поле"
                      onPointerDown={(event) => event.preventDefault()}
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => advanceCheckoutField()}
                    >
                      <Text
                        style={{
                          fontFamily: "Inter",
                          fontSize: 16,
                          fontWeight: "600",
                          color: "#477f17",
                        }}
                      >
                        Готово
                      </Text>
                    </button>
                  </>
                )}
                <Pressable
                  ref={closeButton}
                  role="button"
                  onPress={close}
                  accessibilityLabel="Закрити"
                  style={[
                    s.close,
                    { width: target, height: target, borderRadius: target / 2 },
                    contact && {
                      borderRadius: 4,
                      backgroundColor: "transparent",
                      boxShadow: "none",
                    },
                  ]}
                >
                  <X size={size(22)} />
                </Pressable>
              </View>
              {contact ? (
                <Checkout apiAvailable={API_AVAILABLE} />
              ) : (
                <ScrollView
                  showsVerticalScrollIndicator={false}
                  style={{ overscrollBehavior: "contain" }}
                  contentContainerStyle={{ padding: mobile ? 25 : 38 }}
                >
                  {selected !== null && (
                    <>
                      <RuleImage
                        index={selected}
                        label={projects[selected].title}
                        style={{ marginTop: 20 }}
                      />
                      <Text style={[s.eyebrow, { marginTop: 26 }]}>
                        {projects[selected].category} · ПРАВИЛА ГРИ
                      </Text>
                      <Text role="heading" style={[s.modalTitle]}>
                        {projects[selected].title}
                      </Text>
                      <Text style={s.body}>
                        {projects[selected].description}
                      </Text>
                      <View
                        style={{
                          flexDirection: "row",
                          gap: 8,
                          flexWrap: "wrap",
                          marginTop: 22,
                        }}
                      >
                        {projects[selected].tags.map((tag) => (
                          <Text key={tag} style={s.tag}>
                            {tag}
                          </Text>
                        ))}
                      </View>
                      <View
                        style={{
                          flexDirection: "row",
                          justifyContent: "space-between",
                          marginTop: 30,
                        }}
                      >
                        <Pressable
                          role="button"
                          onPress={() => setSelected((selected + 3) % 4)}
                          style={circleStyle}
                          accessibilityLabel="Попереднє правило"
                        >
                          <ArrowLeft size={size(20)} />
                        </Pressable>
                        <Text style={[s.body, { alignSelf: "center" }]}>
                          {selected + 1} / 4
                        </Text>
                        <Pressable
                          role="button"
                          onPress={() => setSelected((selected + 1) % 4)}
                          style={circleStyle}
                          accessibilityLabel="Наступне правило"
                        >
                          <ArrowRight size={size(20)} />
                        </Pressable>
                      </View>
                    </>
                  )}
                  {activeNote && (
                    <>
                      <Text style={[s.eyebrow, { marginTop: 18 }]}>
                        {activeNote.reel ? "У ПРОЦЕСІ" : "ЩОДЕННИК БІЛДЕРА"}
                      </Text>
                      <Text role="heading" style={s.modalTitle}>
                        {activeNote.title}
                      </Text>
                      <Text style={[s.body, { lineHeight: 29 }]}>
                        {activeNote.body}
                      </Text>
                      {activeNote.reel && (
                        <Button
                          style={{ marginTop: 25, alignSelf: "flex-start" }}
                          onPress={() => {
                            close();
                            go("projects");
                          }}
                        >
                          Переглянути правила
                        </Button>
                      )}
                    </>
                  )}
                </ScrollView>
              )}
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
const s = StyleSheet.create({
  gameDetails: {
    marginTop: 12,
    paddingTop: 18,
    borderTopWidth: 1,
    borderColor: "#e4e7dc",
    maxWidth: 360,
  },

  page: {
    flex: 1,
    alignItems: "center",
    backgroundColor: "#dceafb",
    minHeight: "100vh",
  },
  shell: {
    backgroundColor: "#fffefa",
    borderRadius: 34,
    overflow: "hidden",
    boxShadow: "0 22px 80px #4d739b25",
  },
  hero: { position: "relative", overflow: "hidden" },
  heroImage: {
    position: "absolute",
    width: "100%",
    height: "100%",
    right: 0,
    top: 0,
  },
  heroFade: {
    ...StyleSheet.absoluteFillObject,
    backgroundImage:
      "linear-gradient(90deg, #fffefa 2%, #fffefaef 23%, #fffefab3 34%, #fffefa40 43%, transparent 54%)",
  },
  heroFadeMobile: {
    backgroundImage:
      "linear-gradient(180deg, #fffefa 0%, #fffefa 48%, #fffefa99 65%, transparent 85%)",
  },
  nav: {
    height: 101,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 20,
    zIndex: 3,
    backgroundImage: "linear-gradient(180deg,#fffefae0,transparent)",
  },
  brand: { flexDirection: "row", alignItems: "center", gap: 10 },
  brandText: {
    fontFamily: "Inter",
    fontWeight: "800",
    fontSize: 25,
    letterSpacing: -1,
    color: ink,
  },

  heroCopy: { zIndex: 2, alignItems: "flex-start" },
  eyebrow: {
    fontFamily: "Inter",
    fontSize: 12,
    fontWeight: "750",
    letterSpacing: 2.7,
    color: ink,
  },
  heading: { fontFamily: '"Press Start 2P"', color: ink, letterSpacing: -1.2 },
  body: { fontFamily: "Inter", fontSize: 16, lineHeight: 25, color: ink },
  heroActions: { flexDirection: "row", alignItems: "center", marginTop: 30 },
  button: {
    borderRadius: 23,
    paddingVertical: 16,
    paddingHorizontal: 23,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    transition:
      "transform 200ms ease, background-color 200ms ease, opacity 150ms ease",
  },
  buttonText: {
    fontFamily: "Inter",
    fontSize: 14,
    fontWeight: "600",
    color: "white",
  },
  secondary: {
    borderWidth: 1,
    borderColor: green,
    backgroundColor: "transparent",
  },
  reel: { flexDirection: "row", alignItems: "center", gap: 10 },
  play: {
    width: 43,
    height: 43,
    borderWidth: 1,
    borderColor: "#52505a",
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  heroBottom: {
    position: "absolute",
    bottom: -28,
    left: "-5%",
    width: "110%",
    height: 55,
    backgroundColor: "#fffefa",
    borderRadius: "50%",
  },
  about: { paddingTop: 12, paddingBottom: 30, alignItems: "center" },
  aboutCopy: { borderColor: "#c8c6c8", paddingVertical: 12 },
  textLink: {
    flexDirection: "row",
    alignItems: "center",
    gap: 13,
    marginTop: 18,
    alignSelf: "flex-start",
  },
  linkText: {
    fontFamily: "Inter",
    fontSize: 15,
    color: ink,
    textDecorationLine: "underline",
    textDecorationColor: "#97b778",
  },
  projects: { paddingTop: 10 },
  sectionLabel: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 22,
    marginBottom: 20,
  },
  line: { height: 1, backgroundColor: "#dcdade", flex: 1, maxWidth: 230 },
  cardCaption: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 5,
    paddingTop: 14,
    gap: 5,
  },
  cardTitle: {
    fontFamily: "Inter",
    fontWeight: "600",
    fontSize: 15,
    color: ink,
  },
  category: {
    fontFamily: "Inter",
    fontSize: 10,
    letterSpacing: 1.6,
    color: "#7a7c72",
    marginTop: 7,
  },
  circle: {
    height: 43,
    width: 43,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#d5d6cc",
    backgroundColor: "#fffefb",
    alignItems: "center",
    justifyContent: "center",
  },
  quote: { overflow: "hidden" },
  quoteFade: {
    ...StyleSheet.absoluteFillObject,
    backgroundImage:
      "linear-gradient(90deg,#fffefa 17%,#fffefaee 29%,transparent 60%)",
  },
  quoteMark: {
    fontFamily: "Georgia",
    fontSize: 80,
    color: "#73ad3e",
    lineHeight: 50,
  },
  quoteText: {
    fontFamily: "Inter",
    lineHeight: 36,
    letterSpacing: -1,
    color: ink,
    marginLeft: 30,
    marginTop: -15,
  },
  journal: {
    backgroundColor: "#f5f7ef",
    borderTopWidth: 1,
    borderColor: "#edf0e4",
  },
  journalTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  footer: {
    paddingVertical: 25,
    borderTopWidth: 1,
    borderColor: "#eaece4",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
    flexWrap: "wrap",
  },
  footerText: { fontFamily: "Inter", fontSize: 12, color: "#777b70" },
  overlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#1828168c",
    backdropFilter: "blur(8px)",
  },
  modal: {
    borderRadius: 28,
    backgroundColor: "#fffefa",
    boxShadow: "0 30px 120px #0003",
    overflow: "hidden",
  },
  close: {
    position: "relative",
    width: 38,
    height: 38,
    zIndex: 3,
    borderRadius: 20,
    backgroundColor: "#fffefa",
    alignItems: "center",
    justifyContent: "center",
    boxShadow: "0 2px 12px #0001",
  },
  modalTitle: {
    fontFamily: "Inter",
    fontSize: 30,
    fontWeight: "700",
    lineHeight: 39,
    marginTop: 18,
    marginBottom: 18,
    color: ink,
  },
  tag: {
    fontFamily: "Inter",
    fontSize: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    backgroundColor: "#eef4e5",
    color: "#507734",
  },
});
const paymentOrderId = new URLSearchParams(window.location.search).get(
  "payment",
);
createRoot(document.getElementById("root")).render(
  API_AVAILABLE && paymentOrderId ? (
    <PaymentResult orderId={paymentOrderId} />
  ) : (
    <App />
  ),
);
