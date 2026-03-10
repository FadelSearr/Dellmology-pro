import os
os.environ['ML_ENGINE_KEY'] = 'testkey'
import importlib
m = importlib.import_module('apps.ml_engine.config')
print('Config.ML_ENGINE_KEY=', m.Config.ML_ENGINE_KEY)
print('Config.ADMIN_TOKEN=', m.Config.ADMIN_TOKEN)
