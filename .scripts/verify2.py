import sys, os
print('starting verify2')
sys.path.insert(0, os.path.abspath('apps/ml-engine'))
from dellmology.intelligence import llm_backend
print('imported llm_backend')
print('status:', llm_backend.local_model_status())
