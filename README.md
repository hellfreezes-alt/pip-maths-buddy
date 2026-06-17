# Pip — your child's maths buddy 🌟

This turns the files in this folder into a friendly talking maths tutor your child
can open on a tablet or phone. You set it up once. No coding needed — just clicking
and copy-pasting.

It includes a **Learning Path**: 10 Grade-3 units in order (place value, +/−, times
tables, division, fractions, measurement, money, time, shapes, word problems). Your
child learns each unit with the teacher, then takes a short **Unit Check** — scoring
4 out of 5 masters the unit, earns a medal, and unlocks the next one.

Take your time — about 30–40 minutes the first time. If a button looks slightly
different from what's written here, don't worry; the websites change their wording
sometimes, but the steps are the same.

---

## What you'll need (free to start)

- A **GitHub** account → github.com (this is where the app's files live)
- A **Cloudflare** account → cloudflare.com (this runs the app)
- An **Anthropic** account → console.anthropic.com (this is the "brain"; costs a few cents per use)

Make all three accounts first (just email + password). Then follow the parts below in order.

---

## Part 1 · Get the "brain" key 🔑

The app needs a key so it can think. You get it from Anthropic.

1. Go to **console.anthropic.com** and sign in.
2. Click **Billing** and add a small amount of money (even $5 is plenty — the app costs cents).
3. Click **API keys** → **Create Key**. Name it `Pip`.
4. **Copy the key now** and paste it somewhere safe (a note on your phone). It starts
   with `sk-ant-` and is only shown once. You'll need it in Part 3.

> Tip: in Billing you can set a monthly spending limit, so it can never surprise you.

---

## Part 2 · Put the app's files online 📦

We'll copy this folder up to GitHub so Cloudflare can use it.

The simplest way, no typing commands:

1. Go to **github.com** → click **New** to create a new repository.
2. Name it `pip-maths-buddy`, leave everything else as-is, click **Create repository**.
3. On the next page, click the link that says **"uploading an existing file"**.
4. Drag **all the files and folders from this `pip-cloudflare` folder** into the upload box.
5. Click **Commit changes**.

That's it — your files are now online.

---

## Part 3 · Connect it to Cloudflare ☁️

1. Go to the **Cloudflare dashboard** → in the left menu click **Workers & Pages**.
2. Click **Create**, then the **Pages** tab, then **Connect to Git**.
3. Choose your `pip-maths-buddy` repository.
4. It will ask for build settings. Fill them in exactly:
   - **Framework preset:** Vite
   - **Build command:** `npm run build`
   - **Build output directory:** `dist`
5. Click **Save and Deploy** and wait a minute or two. It will give you a web address
   ending in **.pages.dev** — that's your app!

It won't fully work yet — we need to give it the key and a password. Next part.

---

## Part 4 · Add your key and a secret word 🔐

1. In your new project, click **Settings**, then **Variables and Secrets**
   (it may be called "Environment variables").
2. Click **Add** and create these two, one at a time:

   **First one:**
   - Name (type exactly): `ANTHROPIC_API_KEY`
   - Value: paste the key from Part 1 (the `sk-ant-...` one)
   - Type: **Secret**

   **Second one:**
   - Name (type exactly): `APP_PASSCODE`
   - Value: a **secret word** you choose, that your child can remember (e.g. `banana`)
   - Type: **Secret**

3. Save.

> The **secret word** is just the password to open the app. There's no "correct" one —
> whatever you type here is what your child will type to get in.

---

## Part 5 · The most important click: Redeploy 🔁

The key and password only switch on after a fresh deploy. **This is the step almost
everyone forgets**, and skipping it is what causes "lost the connection."

1. Click the **Deployments** tab.
2. On the top one, click the **⋯** (three dots) → **Retry deployment**.
3. Wait for it to finish.

---

## Part 6 · Try it! 🎉

1. Open your **.pages.dev** address.
2. Type the **secret word** from Part 4.
3. Type your child's name, choose what to call the teacher, pick a topic, and start.
4. At the end, tap **Done 👋** — if a little progress note appears, everything's working.

On a tablet: open the address, then use the browser menu → **Add to Home Screen**, so
it opens from an icon like a real app.

---

## Part 7 (optional) · Save progress, levels & stickers 💾

Without this, the app still works — it just forgets between sessions. To let it
remember (and keep her level, stickers and streak):

1. In Cloudflare, left menu → **Storage & Databases** → **KV** → **Create a namespace**.
   Name it `pip-memory`.
2. Go back to your project → **Settings → Functions → KV namespace bindings → Add binding**.
   - Variable name (type exactly): `PIP_KV`
   - Namespace: choose `pip-memory`
3. **Redeploy again** (Part 5).

---

## Part 8 (optional) · Use your own web address 🌐

If you own a domain (like `chaatgpt.ai`):

1. In your project → **Custom domains → Set up a custom domain**.
2. Type something like `pip.chaatgpt.ai`.
3. Follow the on-screen steps. It sorts out the secure padlock automatically.

---

## If something goes wrong 🛟

**"Lost the connection"** (you got in, but the teacher won't reply):
1. Did you **redeploy** after adding the key? (Part 5) — fix this first, it's usually the cause.
2. Is the key in Cloudflare spelled exactly `ANTHROPIC_API_KEY` and starting with `sk-ant-`?
3. Does your Anthropic account have **credit**? (Part 1, Billing)

**"That passcode didn't work"** → the word typed doesn't match your `APP_PASSCODE` exactly.

**Nothing saves / no stickers** → the KV binding (Part 7) isn't named exactly `PIP_KV`,
or you didn't redeploy after adding it.

**The build failed** → check Part 3 step 4 is exactly right (`npm run build` and `dist`).

Still stuck? Open the app on a computer, press **F12**, click the **Network** tab, tap
"try again" in the app, click the **chat** line, and note the **Status** number —
**500** means the key isn't loaded (redo Parts 4–5), **400** means add credit (Part 1).

---

## Money 💸

You pay only for what's used — roughly **5–20 cents per session**, so daily use is about
a dollar or two a month. Set a monthly limit in the Anthropic console for peace of mind.

## Changing things ✏️

Your child names the teacher right inside the app. To change topics or how the teacher
talks, the wording lives near the top of `src/App.jsx`. This is a learning helper, not a
replacement for her real teacher.
