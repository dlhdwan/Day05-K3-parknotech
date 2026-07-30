# Script to check FlagEmbedding output format
try:
    from FlagEmbedding import BGEM3FlagModel
    model = BGEM3FlagModel('BAAI/bge-m3', use_fp16=False)
    sentences_1 = ["BGE M3 is an embedding model."]
    output = model.encode(sentences_1, return_dense=True, return_sparse=True, return_colbert_vecs=False)
    print("Dense shape:", output['dense_vecs'].shape)
    print("Sparse type:", type(output['lexical_weights']))
    if len(output['lexical_weights']) > 0:
        print("Sparse item sample:", list(output['lexical_weights'][0].items())[:2])
except Exception as e:
    print("Error:", e)
