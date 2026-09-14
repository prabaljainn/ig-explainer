# kubernetes-basics script

## Narration
Your server died at 3am. Your app didn't. || Your server died at 3 a.m. Your app didn't.
That's Kubernetes. It runs your apps and keeps them running.
Each box is a pod: your app, packed in a container.
Pods run on nodes. A node is just a machine.
Many nodes together make a cluster.
The control plane is the brain. You tell it what you want.
Say you want 3 copies. It starts 3 pods. || Say you want three copies. It starts three pods.
When one pod dies, it notices and starts another.
Traffic spikes? Change 3 to 10. It adds 7 more. || Traffic spikes? Change three to ten. It adds seven more.
A service gives those pods one stable address.
Say what you want. Kubernetes keeps it true.

## Scenes
- 0: hook headline in the upper half; below it a row of 3 solid squares (pods) draws in; the middle one gets an X, fades, and a fresh square draws in its place before the line ends
- 1: headline fades; the row of 3 pods rises to the centre of the diagram area and holds
- 2: outer 2 pods fade away; the middle pod grows into a large outline labelled "pod"; inside it a container outline draws, then a solid app square; labels "container" and "app" on the right with leader lines
- 3: the inside collapses; the pod outline fills solid, shrinks to slot size and slides into the top-left slot of the middle node as that node's outline draws around it; label "node"
- 4: left and right node outlines draw; a thin dim outline draws around all 3; label "cluster"
- 5: control plane box draws above the cluster; label "control plane"; "you" appears above it with a short arrow into the box
- 6: "want 3" appears in the control plane box; 2 more pods draw in, one in the left node and one in the right; "have" counts 1 to 3
- 7: the left node's pod gets an X and fades; "have 2" mismatches "want 3"; the box stroke pulses; a new pod draws in the left node's next slot; "have 3"
- 8: "want" counts 3 to 10; 7 pods draw in across the 3 nodes in turn; "have" counts up to 10
- 9: service pill draws below the cluster; thin lines fan from the 3 nodes into it; "traffic" label and arrow enter the pill from the left
- 10: diagram dims; takeaway headline centred
