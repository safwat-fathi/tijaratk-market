# Tijaratk Storefront UI/UX Guide

## Customer Ordering & Category Exploration Experience

## 1. Goal of This Design

The storefront should help Egyptian customers do two things quickly:

1. **Find what they already want**
2. **Discover extra products they may need**

The design should not feel like a complex e-commerce website. It should feel like a clean, simple, trusted digital version of ordering from a local pharmacy, supermarket, grocery, or neighborhood store.

The experience must be:

- Mobile-first
- Arabic-first
- Fast to understand
- Easy for non-technical customers
- Focused on ordering, not browsing for entertainment
- Suitable for WhatsApp/social sharing traffic
- Clear enough for customers who are not used to online checkout

---

# 2. Main UX Principles

## 2.1 Search Comes Before Browsing

For pharmacies especially, customers usually know the product name.

Examples:

- بنادول
- كونجستال
- فيتامين سي
- حفاضات
- مزيل عرق
- شامبو

So the storefront must include a **clear search bar directly under the store header**.

### Required UI

Place this below the header:

```text
🔍 ابحث عن دواء أو منتج
```

### Search Behavior

- Search should filter products immediately.
- Search should match partial names.
- Search should tolerate Arabic spelling differences where possible.
- If no result is found, show a helpful empty state:

```text
مش لاقي المنتج؟
اكتب اسم المنتج وهنبلغ التاجر إنك محتاجه.
[اطلب منتج غير موجود]
```

---

# 3. Recommended Storefront Page Structure

The storefront should follow this order:

```text
1. Store Header
2. Search Bar
3. Store Status / Delivery Info
4. Offers / Featured Products
5. Categories
6. Most Ordered Products
7. Product List
8. Request Missing Product
9. Manual Order
10. Sticky Cart Bar
```

This order is better than showing categories first because many customers come with a clear intention.

---

# 4. Store Header

## Current Issue

The header is visually strong, but it does not show enough practical information.

Egyptian customers care about:

- Is the store open?
- Is delivery available?
- How long will delivery take?
- Can I track my order?

## Required Header Elements

The header should include:

```text
Store logo
Store name
Store category
Track my orders button
Open / closed status
Delivery time or delivery availability
```

### Example

```text
صيدلية الشفاء
صيدلية

مفتوح الآن • التوصيل خلال 30-45 دقيقة
[تتبع طلباتي]
```

## Design Notes

- Keep the green brand/store color.
- Keep the header compact.
- Do not make the logo too dominant.
- The store name should be more important than the icon.

---

# 5. Search Bar

## Placement

Directly below the store header.

## Design

Use a full-width rounded input.

```text
[ 🔍 ابحث عن دواء أو منتج ]
```

## UX Details

- Large tap area.
- Clear placeholder.
- Keep it sticky only if performance and layout allow it.
- On focus, show recent searches if available later.
- MVP can simply filter current products.

## Empty Search State

When no products match:

```text
مش لاقي المنتج؟
اكتب اسم المنتج وهنبلغ التاجر إنك محتاجه.
[اطلب منتج غير موجود]
```

---

# 6. Store Status & Delivery Info

Add a small info row after search.

Examples:

```text
مفتوح الآن
التوصيل متاح
الدفع عند الاستلام
```

Or:

```text
يغلق 11 مساءً
التوصيل خلال 30 دقيقة
```

This builds trust before the customer adds items.

---

# 7. Offers / Featured Products Section

## Why It Matters

Egyptian customers respond strongly to offers. In pharmacies, supermarkets, and groceries, offers increase basket size.

## Placement

After search and delivery info, before categories.

## Section Title

```text
عروض اليوم
```

or

```text
الأكثر طلباً اليوم
```

## Product Card Badge Examples

```text
عرض
الأكثر طلباً
جديد
متوفر
```

## MVP Rule

Even if there is no real discount engine yet, the designer should leave space for badges.

---

# 8. Categories UX

## Current Issue

The category cards are too large. They make browsing slower because only a few categories appear on screen.

## Recommended Layout

Use compact category chips or smaller cards.

### Option A — Horizontal Chips

Best for mobile.

```text
الكل | أدوية | عناية شخصية | فيتامينات | أطفال | مسكنات
```

### Option B — Small Grid

Use 3 columns instead of 2 if images are small.

Each category should include:

```text
Category image
Category name
Product count
```

Example:

```text
أدوية
126 منتج
```

## Category Behavior

When customer taps a category:

- Highlight selected category.
- Scroll to products automatically.
- Show selected category title.
- Keep categories accessible at the top or as horizontal chips.

## Selected Category Example

```text
عناية شخصية
2 منتج
```

---

# 9. Product Cards

## Current Product Card Problems

The product cards are clean but missing conversion details.

Each product card should help the customer decide quickly.

## Required Product Card Elements

Each card should include:

```text
Product image
Product name
Price
Unit / order mode
Availability
Add button
Quantity stepper after adding
Optional badge
```

## Product Card Layout

Recommended mobile layout:

```text
[Image]
Product Name
Price
Unit
Badge / Availability

[-] 1 [+]
```

Or current horizontal layout is acceptable, but the image should be larger.

## Image Size

Increase product image size by around 20–30%.

This is important for:

- Personal care products
- Baby products
- Snacks
- Drinks
- Cosmetics
- Pharmacy OTC products

## Product Name

Product names can be long. Use max 2 lines.

If longer:

```text
1+1 أزهي مزيل عرق رول أون...
```

But make sure the first part of the name is visible.

## Price Format

Use clear Egyptian price formatting:

```text
29 ج.م
```

Avoid small or low-contrast price text.

## Unit Display

Use simple terms:

```text
بالقطعة
بالعلبة
بالكيلو
بالجرام
```

For the current design, replace:

```text
بالعدد
```

with something more natural depending on product:

```text
بالقطعة
```

---

# 10. Add Button & Quantity Stepper

## Current Issue

The quantity stepper is not clear enough. The number is visually weak.

## Before Adding

Show one clear add button:

```text
+
```

or

```text
أضف
```

For Egyptian customers, `+` is acceptable if visually clear.

## After Adding

Show:

```text
[-] 1 قطعة [+]
```

The quantity should be larger and easier to read.

## Important UX Rule

Do not send the customer to checkout after every add. Let them continue browsing.

---

# 11. Sticky Cart Bar

## Required Behavior

When the customer adds at least one item, show a sticky bottom cart bar.

## Recommended Text

```text
1 عنصر • 29 ج.م
[تأكيد الطلب]
```

Or better:

```text
🛒 1 عنصر • 29 ج.م
[عرض الطلب]
```

## Why "عرض الطلب" May Be Better Than "تأكيد الطلب"

“تأكيد الطلب” can feel too final.

Better flow:

```text
عرض الطلب → Review order → Confirm order
```

So the bottom button should preferably say:

```text
عرض الطلب
```

Then inside the cart/review page:

```text
تأكيد الطلب
```

This reduces customer anxiety.

---

# 12. Cart / Order Review UX

Before final confirmation, the customer should see:

```text
Selected products
Quantity controls
Subtotal
Delivery fee
Total
Name
Phone
Address
Notes
Confirm order button
```

## Required Button

```text
تأكيد الطلب
```

## Notes Field

Add a simple notes field:

```text
ملاحظات على الطلب
```

Example placeholder:

```text
مثلاً: لو المنتج غير متوفر ابعتلي بديل
```

This is very useful in Egyptian local ordering.

---

# 13. Request Missing Product

## Current Issue

The “اطلب منتج غير موجود” section is too prominent.

It currently competes with real products and categories.

## Recommended Treatment

Make it smaller and place it lower.

### Compact Version

```text
مش لاقي المنتج؟
اطلبه من هنا
```

Button:

```text
اطلب منتج غير موجود
```

## Placement

Place after main products, not before products.

Exception:

If search returns no results, show it immediately as the empty state.

---

# 14. Manual Order Section

## Purpose

Manual order is useful for customers who want to type a list instead of browsing.

Example:

```text
بنادول
شامبو
علبة لبن
```

## Recommended Placement

Keep it near the bottom, after product discovery.

## Copy

```text
طلب يدوي
مش لاقي اللي انت عايزه؟ اكتب طلبك هنا والتاجر هيرد عليك لو متاح.
```

Button:

```text
اكتب طلبك
```

## Important

Do not make manual order compete with product browsing too early, or customers may skip the catalog completely.

---

# 15. Empty States

## No Products in Category

```text
لا توجد منتجات في هذا القسم حالياً
جرب قسم آخر أو اطلب منتج غير موجود.
[اطلب منتج غير موجود]
```

## No Search Results

```text
مش لاقي المنتج؟
اكتب اسمه وهنبلغ التاجر إنك محتاجه.
[اطلب منتج غير موجود]
```

## Store Closed

```text
المتجر مغلق حالياً
يمكنك تجهيز الطلب وسيتم مراجعته عند فتح المتجر.
```

Button:

```text
جهز الطلب
```

---

# 16. Category Page / Category Selected State

When a user selects a category, the screen should not feel like a new complex page.

Use this structure:

```text
Header
Search
Horizontal category chips
Selected category title
Product list
Sticky cart
```

Example:

```text
عناية شخصية
2 منتج
```

Back button:

```text
رجوع
```

But avoid making the user feel lost.

Better than a large back button:

```text
← كل الأقسام
```

---

# 17. Visual Design Direction

## Style

The visual style should be:

- Clean
- Local
- Friendly
- Trustworthy
- Soft rounded cards
- Not luxury
- Not too playful
- Not corporate

## Colors

Use the store brand color as the primary color.

For pharmacy, green works well.

Use light green backgrounds for secondary sections.

Avoid too many strong colors.

## Cards

Cards should be:

- Rounded
- Soft shadow
- Clear spacing
- Large tap areas
- Not crowded

## Typography

Use Arabic-friendly readable typography.

Product names should be strong but not oversized.

Suggested hierarchy:

```text
Store name: very strong
Section title: strong
Product name: medium/strong
Price: clear
Secondary text: lighter
```

---

# 18. Arabic Copy Guidelines

Use simple Egyptian Arabic.

Avoid formal, stiff wording.

Good:

```text
مش لاقي المنتج؟
اكتب اسمه وهنبلغ التاجر إنك محتاجه.
```

Avoid:

```text
في حالة عدم العثور على المنتج يرجى إدخال اسم المنتج المطلوب.
```

## Recommended Terms

Use:

```text
اطلب
أضف
عرض الطلب
تأكيد الطلب
مش لاقي المنتج؟
ملاحظات
العنوان
رقم الموبايل
الدفع عند الاستلام
```

Avoid:

```text
سلة المشتريات
إتمام عملية الشراء
تسجيل الدخول
حساب العميل
```

Unless absolutely necessary.

---

# 19. Customer Checkout Principles

Do not require login.

Do not ask for unnecessary fields.

Minimum required fields:

```text
Name
Phone
Address
```

Optional:

```text
Notes
Delivery time preference
```

For MVP, keep it simple.

---

# 20. Recommended MVP Improvements

The designer should prioritize these changes first:

## Priority 1 — Must Have

```text
Search bar
Sticky cart bar
Clear quantity stepper
Better product card hierarchy
Store open/delivery info
```

## Priority 2 — Strongly Recommended

```text
Compact categories
Category product count
Offers / featured section
Most ordered products section
Better empty states
```

## Priority 3 — Later

```text
Recently ordered products
Saved address
Reorder previous order
Product alternatives
Product details page
```

---

# 21. Suggested Final Screen Layout

## Home Storefront

```text
[Store Header]
صيدلية الشفاء
مفتوح الآن • التوصيل خلال 30-45 دقيقة
[تتبع طلباتي]

[Search]
ابحث عن دواء أو منتج

[Offers]
عروض اليوم

[Categories]
الكل | أدوية | عناية شخصية | فيتامينات | أطفال

[Most Ordered]
الأكثر طلباً

[Products]
Product cards

[Missing Product]
مش لاقي المنتج؟ اطلبه من هنا

[Manual Order]
اكتب طلبك يدوي

[Sticky Cart]
1 عنصر • 29 ج.م
عرض الطلب
```

---

# 22. Important UX Warning

Do not over-design this storefront like a large e-commerce app.

Tijaratk customers are not shopping like Amazon users.

They are usually:

- Coming from WhatsApp
- In a hurry
- Ordering familiar products
- Paying cash
- Expecting the local merchant to call or message if something is missing

So the UI should support speed, trust, and flexibility more than advanced e-commerce behavior.

---

# 23. Final Designer Checklist

Before handing off the design, confirm these points:

```text
Can the customer search immediately?
Can the customer browse categories easily?
Can the customer add a product with one tap?
Can the customer clearly see selected quantity?
Can the customer review the order before confirming?
Can the customer request a missing product?
Can the customer place an order without login?
Can the customer understand if the store is open?
Can the customer see delivery/payment expectations?
Can the whole flow work comfortably on a small Android phone?
```

If the answer is yes, the design is suitable for Tijaratk MVP.
