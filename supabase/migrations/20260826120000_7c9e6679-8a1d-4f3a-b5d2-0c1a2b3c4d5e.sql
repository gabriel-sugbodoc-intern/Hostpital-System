-- ============ cart_items (server-persisted shopping cart) ============
-- One row per (user, product). The runtime schema uses text ids
-- (see supabase/local/10-align-schema.sql), so columns are text and the
-- foreign keys are added defensively: they apply when the referenced column
-- type is compatible, and are skipped otherwise.

CREATE TABLE public.cart_items (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id text NOT NULL,
  product_id text NOT NULL,
  quantity integer NOT NULL DEFAULT 1 CHECK (quantity > 0),
  variant jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, product_id)
);

CREATE INDEX ON public.cart_items (user_id);

DO $$
BEGIN
  ALTER TABLE public.cart_items
    ADD CONSTRAINT cart_items_user_fk
    FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE public.cart_items
    ADD CONSTRAINT cart_items_product_fk
    FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.cart_items TO authenticated;
GRANT ALL ON public.cart_items TO service_role;
ALTER TABLE public.cart_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cart read own" ON public.cart_items FOR SELECT TO authenticated
  USING (user_id = auth.uid()::text);
CREATE POLICY "cart insert own" ON public.cart_items FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid()::text);
CREATE POLICY "cart update own" ON public.cart_items FOR UPDATE TO authenticated
  USING (user_id = auth.uid()::text)
  WITH CHECK (user_id = auth.uid()::text);
CREATE POLICY "cart delete own" ON public.cart_items FOR DELETE TO authenticated
  USING (user_id = auth.uid()::text);
