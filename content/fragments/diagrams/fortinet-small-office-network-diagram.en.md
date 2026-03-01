---
id: fortinet-small-office-network-diagram
language: en
title: Fortinet Small Office Network Diagram
category: diagrams
type: diagram
version: 2025-01
status: production
tags:
  - "fortinet"
  - "network"
  - "small-office"
  - "diagram"
sensitivity: normal
author: rick.cogley@esolia.co.jp
created: 2026-02-20
modified: 2026-02-20
allowed_collections:
  - "proposals"
  - "help"
  - "concepts"
diagram_format: mermaid
usage_notes: Generic network topology diagram for Fortinet small office proposals.
---

```mermaid
flowchart TB
    internet["🌐 Fiber Internet<br/>(ISP)"]
    ont["ONT / ONU"]

    subgraph rack["Office Rack"]
        ups["UPS<br/>(Rack Mount)"]
        fw["FortiWifi<br/>Firewall · Router · Wi-Fi"]
        sw["FortiSwitch<br/>Managed Switch"]
    end

    subgraph wired["Wired Devices"]
        desktop["🖥️ Desktops"]
        printer["🖨️ Printers"]
        phone["📞 IP Phones"]
    end

    subgraph wireless["Wireless Devices"]
        laptop["💻 Laptops"]
        mobile["📱 Mobile"]
        tablet["Tablets"]
    end

    internet --- ont
    ont --- fw
    fw --- sw
    sw --- desktop
    sw --- printer
    sw --- phone
    fw -.-|"Wi-Fi"| laptop
    fw -.-|"Wi-Fi"| mobile
    fw -.-|"Wi-Fi"| tablet

    ups ~~~ fw
    ups ~~~ sw

    style rack fill:#fef3c7,stroke:#f59e0b
    style wired fill:#dbeafe,stroke:#3b82f6
    style wireless fill:#d1fae5,stroke:#10b981
    style fw fill:#e11d48,color:#fff
    style sw fill:#e11d48,color:#fff
```

Fiber internet connects to the FortiWifi, which handles firewall, routing, and wireless for the office. The FortiSwitch provides wired connections for desktops, printers, and phones. All equipment sits in a compact rack with UPS power protection. Wireless devices connect directly through the FortiWifi's built-in access point.
