# Xcode reference — 1.1 (80)

The owner confirmed simulator startup using the UIScene archive, then incremented the native build to 80. This branch ports the scene lifecycle and lazy MIDI startup into the generator. It is not a byte-for-byte copy of the owner's locally edited project. The package workflow must pass the simulator startup gate before export. The export includes local npm plugin sources required by SPM. Device/TestFlight verification remains pending. Existing web regression tests may contain stale build assertions.
