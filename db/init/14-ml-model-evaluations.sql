-- 14-ml-model-evaluations.sql
-- Create table for persisting model evaluation results

CREATE TABLE IF NOT EXISTS public.ml_model_evaluations (
  id bigserial PRIMARY KEY,
  model_name text NOT NULL,
  champion text,
  challenger text,
  metrics jsonb,
  passed boolean DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  notes text
);

-- Optional index to query recent evaluations by model
CREATE INDEX IF NOT EXISTS idx_ml_model_evaluations_model_created ON public.ml_model_evaluations (model_name, created_at DESC);
