# Магнітні Шахи — React Native Web

Локальный адаптивный сайт на React Native и React Native Web. Основные элементы интерфейса: View, Text, Image, Pressable, ScrollView, Modal и TextInput. Vite собирает браузерную версию; alias react-native → react-native-web.

## Запуск

```sh
npm install
npm run dev
```

Открыть http://127.0.0.1:5173.

```sh
npm run build
npm run preview
```

## Возможности

- Адаптивная страница игры: мобильная версия, планшет и компьютер.
- Четыре отдельно обработанные иллюстрации правил, подробности в модальном окне.
- Свайп и привязка карточек к краю на телефоне; две колонки на планшете и четыре на компьютере.
- Плавное раскрытие описания, появление разделов при прокрутке и анимация окон.
- Настройка уменьшенного движения учитывается автоматически.
- Форма заказа с поиском города и отделения Новой пошты, онлайн-оплатой и оплатой при получении.
- Контактный блок: реальные контакты добавляются в `feedbackContacts` в `src/Feedback.jsx`. Пустые контакты не ведут на чужие адреса.
- Исходные пиксельные шрифты и иллюстрации сохранены. Основные картинки подаются в WebP.

## Проверка и изображения

```sh
npm test
npm run format:check
npm run build
```

Тесты оплаты используют имитацию ответа банка и не создают реальные платежи. Проверки доставки не обращаются к Новой поште.

`npm run assets:optimize` обновляет WebP-копии исходных PNG. Исходники остаются на месте. Для последнего набора иллюстраций размер уменьшился с 18,86 до 2,08 МБ.

## GitHub и размещение

Сайт: https://lolittajdm-alt.github.io/Magic-magic/

В Settings → Pages выбран Source: **GitHub Actions**. Workflow `.github/workflows/deploy-pages.yml` проверяет и собирает сайт при обновлении `main`, затем публикует только `dist`. Не переключайте Pages на `main / (root)`: там находятся исходники, которые браузер не может запустить без Vite.

Для проверки этой сборки локально:

```sh
npm run build:pages
npm run preview -- --mode pages
```

Открыть http://127.0.0.1:4173/Magic-magic/. Режим `pages` задаёт базовый путь `/Magic-magic/`; изображения используют `assetUrl`, шрифты обрабатывает Vite. В этой статической версии доступна полная форма с предварительным просмотром заказа: контакты, ручной ввод доставки, количество и выбор оплаты. Отправка и оплата явно недоступны; данные остаются только в памяти страницы, серверные запросы не выполняются. Обычная локальная версия сохраняет форму заказа и серверные маршруты.

В репозиторий можно загружать исходники и публичные изображения. `.env.local`, `.data`, резервные копии и локальные снимки экрана исключены через `.gitignore`. Для настройки сервера скопируйте `.env.example` в `.env.local` и заполните значения локально.

GitHub Pages подходит только для статической витрины. Поиск доставки, оформление заказа и оплата требуют Node-сервера; публикация одной папки `dist` их не запускает. Текущий сервер подключён к локальному Vite и preview. Для рабочего магазина нужен отдельный production-сервер с постоянным приватным хранилищем заказов и HTTPS.

## Checkout and mono payments

The checkout validates contacts, quantity and delivery selection using Nova Poshta lookup. One set costs 10.00 UAH. The checkout offers online payment or cash on delivery. The online action validates the form, creates an invoice on the server and redirects to the hosted mono payment page. Cash on delivery confirms and stores an unpaid order locally, with a server-calculated transfer fee of 2% + 20 UAH; shipping is charged separately. No card details are collected by this app. Google Pay and Apple Pay are not separate integrations.

Server-only `.env.local` settings:

- `NOVA_POSHTA_API_KEY`: delivery lookups.
- `MONO_API_TOKEN`: acquiring token; never use a `VITE_` prefix.
- `APP_ORIGIN`: exact site origin, defaults to `http://127.0.0.1:5173`. Set the real HTTPS origin when deploying; local preview on another port needs a matching value.

`npm run dev` and `npm run preview` provide the server routes. Static hosting of `dist` alone cannot process orders or payments. Production needs a persistent Node server, durable private storage, HTTPS and the configured origin.

Payment endpoints: `GET /api/payments/config`, `POST /api/payments/create`, `POST /api/payments/cod`, `GET /api/payments/status?orderId=...`. An HttpOnly session cookie restricts status access. Creation accepts quantity and delivery/contact details, recalculates the amount server-side and persists the order in ignored `.data/orders/` before contacting mono. Keep this directory private and back it up: it is the seller's local order record. No shipping label, seller notification or fulfillment automation is created.

Repeated requests with the same request ID reuse the invoice. A timeout after contacting mono is treated as ambiguous and cannot silently create another invoice with that ID. The payment return page queries mono to confirm the invoice ID, currency, amount and status; a redirect alone never marks an order paid. No webhook is configured on localhost. Status refresh currently occurs when the buyer returns to the result page or manually requests another check; orders paid without a return must be reconciled in the mono merchant account.

Checks: `node --test server/payments.test.js` and `npm run build`. Tests use a mocked bank and do not charge cards.
