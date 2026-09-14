# kubernetes-basics

Topic: what Kubernetes is and how it thinks, in one diagram (pod, node, cluster, control plane, desired state, self-healing, scaling, service)
Audience: developers and tech-curious viewers who have heard the word and never had it drawn for them
The one surprising idea: you never tell Kubernetes what to do. You tell it what you want, and it works forever to make reality match: a dead pod is replaced, 3 becomes 10, and the front door never changes.
Hero diagram (the single visual the whole video is built around): a vertical stack. "you" feeds a control plane box that shows "want N  have N". Below it, a cluster outline holding three node boxes, each with a 2x2 grid of pod slots (solid white squares). Below the cluster, a service pill that traffic enters from the left and that fans out to the nodes. The whole video is that one diagram being built up, then exercised: a pod dies and is replaced, want goes 3 to 10 and pods fill in.
Engine: remotion
Why this engine: it is boxes, labels and counters, no geometry that changes shape. Remotion's typography and layout are the point; Manim would fight the text.
Accent color: none
Audio: full narration on every line (the user asked for "full ergonomic audio"; read as complete, easy-listening voiceover). Re-narrated 2026-09-09 in the author's cloned voice: `.venv-clone/bin/python tools/tts.py videos/kubernetes-basics --engine chatterbox --lang a --voice brand/voice/<name>.wav --cfg 0.3 --exaggeration 0.5 --temperature 0.7 --takes 10` (first version used Kokoro af_heart). Spoken forms spell out the digits.
Notes / overrides to CLAUDE.md: none. Hook simplifies "server died" to a pod dying and being replaced; the node-failure case is the same loop one level up, and the diagram vocabulary (solid square = pod) is established by the hook itself.
