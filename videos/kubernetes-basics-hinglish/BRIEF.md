# kubernetes-basics-hinglish

Topic: Hinglish cut of kubernetes-basics: the same Kubernetes mental model (pod, node, cluster, control plane, desired state, self-healing, scaling, service), narrated in code-mixed Hindi-English the way Indian tech creators talk
Audience: Hindi-speaking developers and tech-curious viewers who consume Hinglish content on Instagram
The one surprising idea: same as the English cut. Aap batate ho kya chahiye; Kubernetes usse sach banaye rakhta hai.
Hero diagram (the single visual the whole video is built around): identical to kubernetes-basics. The composition is shared (engine/remotion/src/videos/kubernetes-basics exports makeVideo); this video keeps the English diagram labels (pod, node, cluster, control plane, service, traffic are the words Hinglish speakers use) and the house typeface, since captions are Roman script.
Engine: remotion
Why this engine: the English cut is Remotion; the Hinglish cut reuses its composition and retimes itself to the new narration.
Accent color: none
Audio: Chatterbox voice clone, `--engine chatterbox --lang h --voice brand/voice/<name>.wav --cfg 0.3 --exaggeration 0.5 --temperature 0.6 --takes 10`; the reference is the cleanest 10 s window of brand/voice/<name>.wav. Each script line carries a Roman caption and a spoken form after ` || `: Hindi words in Devanagari, English tech words left in English, which is the form the author picked by ear on 2026-09-09. Reference clip in place since 2026-09-09; the first preview used a stand-in voice.
Notes / overrides to CLAUDE.md: none. "12 words or fewer" applies to the Roman caption. Line 2 says app before container, so the English beats apply.
