import Foundation
import CoreMIDI
import Capacitor

@objc(CantoriaBridgeViewController)
open class CantoriaBridgeViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        super.capacitorDidLoad()
        bridge?.registerPluginInstance(CantoriaMIDIPlugin())
    }
}

@objc(CantoriaMIDIPlugin)
public class CantoriaMIDIPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "CantoriaMIDIPlugin"
    public let jsName = "CantoriaMIDI"
    public let pluginMethods: [CAPPluginMethod] = [CAPPluginMethod(name: "pull", returnType: CAPPluginReturnPromise)]
    private var client = MIDIClientRef()
    private var port = MIDIPortRef()
    private var connectedSources = Set<MIDIEndpointRef>()
    private let lock = NSLock()
    private var events: [JSObject] = []
    private var seq = 0
    override public func load() {
        MIDIClientCreateWithBlock("Cantoria MIDI" as CFString, &client) { [weak self] _ in self?.refreshSources() }
        MIDIInputPortCreateWithBlock(client, "Cantoria Input" as CFString, &port) { [weak self] list, _ in
            guard let self = self else { return }
            var packet = list.pointee.packet
            for _ in 0..<Int(list.pointee.numPackets) {
                let data = withUnsafeBytes(of: packet.data) { Array($0.prefix(Int(packet.length))) }
                var i = 0
                while i < data.count {
                    let status = data[i], kind = status & 0xF0
                    if (kind == 0x90 || kind == 0x80) && i + 2 < data.count {
                        let note = Int(data[i+1]), velocity = Int(data[i+2])
                        self.lock.lock(); self.seq += 1
                        self.events.append(["seq": self.seq, "note": note, "channel": Int(status & 0x0F), "on": kind == 0x90 && velocity > 0])
                        if self.events.count > 512 { self.events.removeFirst(self.events.count - 512) }
                        self.lock.unlock(); i += 3
                    } else if kind == 0xB0 || kind == 0xE0 || kind == 0xA0 { i += 3 }
                    else if kind == 0xC0 || kind == 0xD0 { i += 2 }
                    else { i += 1 }
                }
                packet = MIDIPacketNext(&packet).pointee
            }
        }
        refreshSources()
    }
    private func refreshSources() {
        lock.lock(); defer { lock.unlock() }
        let count = MIDIGetNumberOfSources()
        var current = Set<MIDIEndpointRef>()
        for i in 0..<count {
            let source = MIDIGetSource(i)
            guard source != 0 else { continue }
            current.insert(source)
            if !connectedSources.contains(source) { MIDIPortConnectSource(port, source, nil) }
        }
        for old in connectedSources.subtracting(current) { MIDIPortDisconnectSource(port, old) }
        connectedSources = current
    }
    @objc func pull(_ call: CAPPluginCall) {
        refreshSources()
        let after = call.getInt("after") ?? 0
        lock.lock()
        let data = events.filter { ($0["seq"] as? Int ?? 0) > after }
        let count = connectedSources.count
        lock.unlock()
        call.resolve(["events": data, "connected": count > 0])
    }
    deinit { if port != 0 { MIDIPortDispose(port) }; if client != 0 { MIDIClientDispose(client) } }
}
