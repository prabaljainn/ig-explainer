# kubernetes-basics-ja

Topic: Japanese cut of kubernetes-basics: the same Kubernetes mental model (pod, node, cluster, control plane, desired state, self-healing, scaling, service), narrated and captioned in Japanese
Audience: Japanese-speaking developers and tech-curious viewers
The one surprising idea: same as the English cut. You never tell Kubernetes what to do; you tell it what you want and it keeps reality matching.
Hero diagram (the single visual the whole video is built around): identical to kubernetes-basics. The composition is shared (engine/remotion/src/videos/kubernetes-basics exports makeVideo); this video supplies Japanese labels, the CJK typeface, a wider control-plane box, and the two line-2 beats in Japanese word order (コンテナ before アプリ). Every other sub-beat is a fraction of its line, so the Japanese narration retimes the diagram by itself.
Engine: remotion
Why this engine: the English cut is Remotion; the Japanese cut reuses its composition, so the visuals retime themselves to the Japanese narration with no scene changes.
Accent color: none
Audio: re-narrated 2026-09-09 in the author's cloned voice, cross-lingual from the English clip: `--engine chatterbox --lang j --ref-lang a --voice brand/voice/<name>.wav --cfg 0.3 --exaggeration 0.5 --temperature 0.7 --takes 10` (first version used Kokoro jf_alpha). Lines 5 and 8 carry kana spoken forms.
Notes / overrides to CLAUDE.md: typeface is Noto Sans JP (brand/style.json font.family_ja) because Instrument Sans has no CJK glyphs; same sizes and weights. Script rule "12 words or fewer" is read as 12 full-width characters per headline line and about 26 characters per caption. Kubernetes is written クバネティス so the narration says it correctly; the diagram vocabulary (solid square = pod) is unchanged.
