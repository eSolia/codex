UPDATE fragments
SET content_ja = '<div data-source="flowchart TB
    internet[&quot;🌐 光ファイバー&lt;br/&gt;(ISP)&quot;]
    ont[&quot;ONT / ONU&quot;]

    subgraph rack[&quot;オフィスラック&quot;]
        ups[&quot;UPS&lt;br/&gt;(ラックマウント)&quot;]
        fw[&quot;FortiWifi&lt;br/&gt;ファイアウォール・ルーター・Wi-Fi&quot;]
        sw[&quot;FortiSwitch&lt;br/&gt;マネージドスイッチ&quot;]
    end

    subgraph wired[&quot;有線デバイス&quot;]
        desktop[&quot;🖥️ デスクトップ&quot;]
        printer[&quot;🖨️ プリンター&quot;]
        phone[&quot;📞 IP電話&quot;]
    end

    subgraph wireless[&quot;無線デバイス&quot;]
        laptop[&quot;💻 ノートPC&quot;]
        mobile[&quot;📱 モバイル&quot;]
        tablet[&quot;タブレット&quot;]
    end

    internet --- ont
    ont --- fw
    fw --- sw
    sw --- desktop
    sw --- printer
    sw --- phone
    fw -.-|&quot;Wi-Fi&quot;| laptop
    fw -.-|&quot;Wi-Fi&quot;| mobile
    fw -.-|&quot;Wi-Fi&quot;| tablet

    ups ~~~ fw
    ups ~~~ sw
" data-svg-path="diagrams/mermaid-1771563229306-tyykia.svg" data-type="mermaidBlock" class="mermaid-block"><div class="mermaid-diagram"></div></div>',
    updated_at = datetime('now')
WHERE id = 'fortinet-small-office-network-diagram';
