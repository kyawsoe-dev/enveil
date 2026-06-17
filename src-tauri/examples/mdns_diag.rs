/// Standalone mDNS diagnostic — browses _enveil._tcp and prints
/// every resolved service with its addresses, hostname, and port.
///
/// Usage:
///   cargo run --example mdns_diag
///
/// Run `test_peer.py` in another terminal first to have a service to discover.
use mdns_sd::{ServiceDaemon, ServiceEvent, ServiceInfo};
use std::sync::mpsc;
use std::thread;
use std::time::Duration;

const SERVICE_TYPE: &str = "_enveil._tcp.local.";

fn main() {
    println!("[diag] Creating ServiceDaemon...");
    let daemon = ServiceDaemon::new().expect("Failed to create daemon");

    // Register a diagnostic service with LOWERCASE hostname
    let my_hostname = format!("diag-host.{}.", "local").to_lowercase();
    println!("[diag] Registering diag-test service (hostname={})", my_hostname);
    let service_info = ServiceInfo::new(
        SERVICE_TYPE,
        "diag-test",
        &my_hostname,
        "",
        9999,
        &[] as &[(&str, &str)],
    )
    .expect("Failed to create service info")
    .enable_addr_auto();

    daemon
        .register(service_info)
        .expect("Failed to register");

    println!("[diag] Browsing for {} ...", SERVICE_TYPE);
    let receiver = daemon.browse(SERVICE_TYPE).expect("Failed to browse");

    let (tx, rx) = mpsc::channel();
    thread::spawn(move || {
        for event in receiver {
            match event {
                ServiceEvent::ServiceResolved(info) => {
                    let device_name = info
                        .get_fullname()
                        .split('.')
                        .next()
                        .unwrap_or("unknown");
                    println!("\n=== ServiceResolved ===");
                    println!("  device_name : {:?}", device_name);
                    println!("  fullname    : {:?}", info.get_fullname());
                    println!("  hostname    : {:?}", info.get_hostname());
                    println!("  port        : {}", info.get_port());
                    let addrs: Vec<String> = info
                        .get_addresses()
                        .iter()
                        .map(|a| a.to_string())
                        .collect();
                    println!("  addresses   : {:?}", addrs);
                    let v4: Vec<String> = addrs
                        .iter()
                        .filter(|a| a.contains('.'))
                        .cloned()
                        .collect();
                    println!("  IPv4        : {:?}", v4);
                    let _ = tx.send(());
                }
                ServiceEvent::ServiceFound(service_type, full_name) => {
                    println!("  Found: {} / {}", service_type, full_name);
                }
                ServiceEvent::ServiceRemoved(service_type, full_name) => {
                    println!("  Removed: {} / {}", service_type, full_name);
                }
                ServiceEvent::SearchStarted(_) => println!("  Search started"),
                ServiceEvent::SearchStopped(_) => println!("  Search stopped"),
                other => println!("  Other: {:?}", other),
            }
        }
    });

    // Wait up to 30 seconds for at least one resolution
    match rx.recv_timeout(Duration::from_secs(30)) {
        Ok(_) => println!("\n[diag] Success — got a resolution!"),
        Err(_) => println!("\n[diag] No services resolved within 30s"),
    }
}
