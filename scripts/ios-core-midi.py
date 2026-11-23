#!/usr/bin/env python3
import pathlib,sys
verify='--verify' in sys.argv
args=[a for a in sys.argv[1:] if a!='--verify']
if len(args)!=2:sys.exit('Usage: ios-core-midi.py [--verify] AppDelegate.swift Main.storyboard')
delegate,story=map(pathlib.Path,args)
mark='CANTORIA_CORE_MIDI_V64'
s=delegate.read_text();t=story.read_text();old='customClass="CAPBridgeViewController" customModule="Capacitor"';new='customClass="CantoriaBridgeViewController" customModule="App"'
if verify:
 assert s.count(mark)==1 and 'MIDIInputPortCreateWithBlock' in s
 assert t.count(new)==1
 print('PASS Core MIDI native bridge')
else:
 assert mark not in s and old in t
 delegate.write_text(s+'\n// '+mark+'\n'+pathlib.Path('scripts/ios-core-midi.swift').read_text())
 story.write_text(t.replace(old,new))
