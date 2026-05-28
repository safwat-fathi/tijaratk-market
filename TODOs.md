# Todo list

## Pricing plans gatting for merchants

- Every merchant should be subscribed to a plan.
- There should be a plan page where users can see available plans.
- There should be a page for each merchant to subscribe to a plan.
- Plans should have a list of features that are included in the plan.

Note: **pricing plans features details is in `pricing-plans.md`**

## Fix issues

1. Fix overflow in store page after selecting a category (the `CategoryProductsView` component is the suspect)

## New Features

1. Add phone number customer search on input in `OrderForm` component. Use `@react-hook/debounce` for the search. Search should be triggered only if user data is not found in browser cache.
