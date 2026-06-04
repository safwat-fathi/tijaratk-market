## 2026-05-30 - Frontend performance: Server-side filtering
**Learning:** Found a major performance issue in `frontend/app/(dashboard)/merchant/(features)/page.tsx`. It was fetching ALL historical orders via `ordersService.getOrders()` and filtering them in-memory to get `todayOrders`. The backend `ordersService.getOrders` actually accepts an optional `date` query parameter.
**Action:** Always check the service and backend implementation to see if data can be filtered at the database level instead of in-memory on the frontend.
