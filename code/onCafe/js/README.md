# ONCafe JavaScript architecture

JavaScript uses a shared technical-layer structure under `js/`. Do not add a `packages/` layer or duplicate technical layers inside business areas.

```text
js/
├── app.js
├── menu.js
├── my-orders.js
├── config/
├── controllers/
│   ├── admin/
│   └── customer/
├── models/
├── repositories/
├── services/
├── ui/
│   ├── admin/
│   └── customer/
├── utils/
│   └── admin/
├── validators/
└── views/
    ├── admin/
    ├── auth/
    └── customer/
```

## Responsibilities and dependency direction

| Layer | Responsibility | Must not do |
|---|---|---|
| `config/` | Initialize external clients and shared configuration | Contain business workflows |
| `controllers/` | Coordinate page startup, events and application flow | Build large blocks of presentation markup |
| `models/` | Represent and normalize domain data | Access the DOM or Supabase |
| `repositories/` | Read and write application data through Supabase | Render UI or decide page navigation |
| `services/` | Enforce application/business rules and coordinate repositories | Manipulate DOM elements |
| `views/` | Render complete screens and handle presentation-level interactions | Query Supabase directly |
| `ui/` | Small reusable presentation components | Own application workflows |
| `validators/` | Validate input and present validation feedback | Persist data |
| `utils/` | Stateless shared formatting and calculation helpers | Hold page state or perform I/O |

Preferred flow:

```text
Page entry point -> Controller -> Service -> Repository -> Supabase
                         |
                         +-> View -> UI components
                         |
                         +-> Validator / Utils
```

Keep dependencies moving inward through explicit imports and constructor/function parameters. A view should receive callbacks or data; it should not instantiate repositories or connect to Supabase.

## Placement rules

- Keep shared `services/`, `repositories/`, `validators/` and `utils/` at the `js/` level. Do not create copies under `admin/` or `customer/`.
- Add a subfolder only when several files share a real responsibility or business scope. Do not create folders for a single file without a clear reason.
- `ui/` is for reusable visual building blocks; `views/` is for complete screen/panel rendering.
- `utils/` contains pure helpers. Put helpers in a subfolder such as `utils/admin/` only when their use is genuinely limited to that area.
- `validators/` contains input rules. `ValidationUI.js` may render validation feedback, but should remain separate from domain validation rules.
- Use names that describe the responsibility. For example, `ui/admin/AdminNavButton.js` creates a navigation button, while `utils/admin/AdminNavigation.js` contains navigation rules and URL mapping.
- Keep page entry files small: they should import the relevant controller or page module, not contain business logic.

## Current page entry points

- `app.js` starts the admin workspace through `controllers/admin/AdminController.js`.
- `menu.js` starts the customer menu through `controllers/customer/CustomerMenuController.js`.
- `my-orders.js` starts the customer order-history page.
- Authentication and customer navigation are currently initialized by modules under `views/auth/` and `views/customer/`. Treat these as legacy page bootstraps; move them to dedicated controllers only when their page flow is refactored and all HTML script paths can be updated together.

## Change checklist

Before moving, splitting or renaming a module:

1. Identify its single responsibility and all importers.
2. Keep business rules and data access in their existing layers.
3. Update every import and HTML script path affected by the change.
4. Check relative paths from nested pages.
5. Verify there are no stale references to the old path.
6. Run the affected page flows, especially authentication, role permissions, orders, stock and QR payment.

Prefer small, behavior-preserving refactors. Do not split a file solely because it is long; split it when it has independent responsibilities or a cohesive unit that can be tested and reused.
