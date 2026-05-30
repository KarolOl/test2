package pl.example.springtest.service;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.security.cert.CertificateException;
import java.security.cert.CertificateFactory;
import java.security.cert.X509Certificate;
import java.time.Duration;
import java.util.ArrayList;
import java.util.Base64;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.function.Predicate;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import javax.xml.XMLConstants;
import javax.xml.parsers.DocumentBuilder;
import javax.xml.parsers.DocumentBuilderFactory;
import javax.xml.parsers.ParserConfigurationException;

import org.springframework.stereotype.Service;
import org.w3c.dom.Document;
import org.w3c.dom.Element;
import org.w3c.dom.Node;
import org.xml.sax.SAXException;

import pl.example.springtest.dto.RevocationEndpointDto;

@Service
public class TslRevocationInfoService {

    private static final URI EU_LOTL_URI = URI.create("https://ec.europa.eu/tools/lotl/eu-lotl.xml");
    private static final String CRL_DISTRIBUTION_POINTS_OID = "2.5.29.31";
    private static final String AUTHORITY_INFORMATION_ACCESS_OID = "1.3.6.1.5.5.7.1.1";
    private static final String OCSP_ACCESS_METHOD_OID = "1.3.6.1.5.5.7.48.1";
    private static final String POLISH_SCHEME_TERRITORY = "PL";
    private static final String SERVICE_TYPE_CRL_MARKER = "/CRL";
    private static final String SERVICE_TYPE_OCSP_MARKER = "/OCSP";
    private static final Pattern URI_PATTERN = Pattern.compile("(?:https?|ldap|file)://[^\\s<>\"']+");

    private final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(15))
            .followRedirects(HttpClient.Redirect.NORMAL)
            .build();

    public List<RevocationEndpointDto> printRevocationEndpointsFromEuLotl() {
        List<RevocationEndpointDto> endpoints = findRevocationEndpointsFromEuLotl();

        endpoints.forEach(endpoint -> {
            System.out.println("TSL: " + endpoint.tslLocation());
            System.out.println("Source: " + endpoint.certificateSubject());
            endpoint.crlUrls().forEach(url -> System.out.println("CRL: " + url));
            endpoint.ocspUrls().forEach(url -> System.out.println("OCSP: " + url));
            System.out.println();
        });

        return endpoints;
    }

    public List<RevocationEndpointDto> findRevocationEndpointsFromEuLotl() {
        Document lotl = fetchXml(EU_LOTL_URI);
        List<URI> tslLocations = findTslLocations(lotl);
        List<RevocationEndpointDto> endpoints = new ArrayList<>();

        for (URI tslLocation : tslLocations) {
            try {
                Document tsl = fetchXml(tslLocation);
                endpoints.addAll(findRevocationEndpoints(tslLocation, tsl));
            } catch (RuntimeException ex) {
                System.err.println("Cannot process TSL " + tslLocation + ": " + ex.getMessage());
            }
        }

        return endpoints;
    }

    private List<URI> findTslLocations(Document lotl) {
        return descendants(lotl.getDocumentElement(), "OtherTSLPointer").stream()
                .filter(pointer -> hasSchemeTerritory(pointer, POLISH_SCHEME_TERRITORY))
                .flatMap(pointer -> descendants(pointer, "TSLLocation").stream())
                .map(Element::getTextContent)
                .map(String::trim)
                .filter(location -> !location.isBlank())
                .filter(this::isXmlLocation)
                .map(URI::create)
                .distinct()
                .toList();
    }

    private boolean hasSchemeTerritory(Element pointer, String territory) {
        return descendants(pointer, "SchemeTerritory").stream()
                .map(Element::getTextContent)
                .map(String::trim)
                .anyMatch(territory::equalsIgnoreCase);
    }

    private boolean isXmlLocation(String location) {
        try {
            String path = URI.create(location).getPath();
            return path != null && path.toLowerCase().endsWith(".xml");
        } catch (IllegalArgumentException ex) {
            return false;
        }
    }

    private List<RevocationEndpointDto> findRevocationEndpoints(URI tslLocation, Document tsl) {
        List<RevocationEndpointDto> endpoints = new ArrayList<>();
        endpoints.addAll(findServiceSupplyPointEndpoints(tslLocation, tsl));

        for (Element certificateElement : descendants(tsl.getDocumentElement(), "X509Certificate")) {
            try {
                X509Certificate certificate = parseCertificate(certificateElement.getTextContent());
                List<String> crlUrls = merge(
                        certificateExtensionUris(certificate, CRL_DISTRIBUTION_POINTS_OID),
                        extensionUriFallback(certificate, CRL_DISTRIBUTION_POINTS_OID, this::looksLikeCrlUri)
                );
                List<String> ocspUrls = merge(
                        ocspUris(certificate),
                        extensionUriFallback(certificate, AUTHORITY_INFORMATION_ACCESS_OID, this::looksLikeOcspUri)
                );

                if (!crlUrls.isEmpty() || !ocspUrls.isEmpty()) {
                    endpoints.add(new RevocationEndpointDto(
                            tslLocation.toString(),
                            certificate.getSubjectX500Principal().getName(),
                            crlUrls,
                            ocspUrls
                    ));
                }
            } catch (RuntimeException ex) {
                System.err.println("Cannot process X509Certificate from " + tslLocation + ": " + ex.getMessage());
            }
        }

        return endpoints;
    }

    private List<RevocationEndpointDto> findServiceSupplyPointEndpoints(URI tslLocation, Document tsl) {
        List<RevocationEndpointDto> endpoints = new ArrayList<>();

        for (Element service : descendants(tsl.getDocumentElement(), "TSPService")) {
            childElements(service, "ServiceInformation").stream()
                    .findFirst()
                    .ifPresent(serviceInformation -> addServiceSupplyPointEndpoint(tslLocation, serviceInformation, endpoints));

            for (Element historyInstance : descendants(service, "ServiceHistoryInstance")) {
                addServiceSupplyPointEndpoint(tslLocation, historyInstance, endpoints);
            }
        }

        return endpoints;
    }

    private void addServiceSupplyPointEndpoint(
            URI tslLocation,
            Element serviceInformation,
            List<RevocationEndpointDto> endpoints
    ) {
        String serviceType = firstDescendantText(serviceInformation, "ServiceTypeIdentifier");
        if (serviceType.isBlank()) {
            return;
        }

        List<String> supplyPoints = descendants(serviceInformation, "ServiceSupplyPoint").stream()
                .map(Element::getTextContent)
                .map(String::trim)
                .filter(supplyPoint -> !supplyPoint.isBlank())
                .distinct()
                .toList();

        if (supplyPoints.isEmpty()) {
            return;
        }

        String serviceName = firstDescendantText(serviceInformation, "Name");
        String label = "TSL service: %s (%s)".formatted(
                serviceName.isBlank() ? "unnamed" : serviceName,
                serviceType
        );

        if (isCrlServiceType(serviceType)) {
            endpoints.add(new RevocationEndpointDto(tslLocation.toString(), label, supplyPoints, List.of()));
        }

        if (isOcspServiceType(serviceType)) {
            endpoints.add(new RevocationEndpointDto(tslLocation.toString(), label, List.of(), supplyPoints));
        }
    }

    private boolean isCrlServiceType(String serviceType) {
        return serviceType.toUpperCase().contains(SERVICE_TYPE_CRL_MARKER);
    }

    private boolean isOcspServiceType(String serviceType) {
        return serviceType.toUpperCase().contains(SERVICE_TYPE_OCSP_MARKER);
    }

    private String firstDescendantText(Element root, String localName) {
        return descendants(root, localName).stream()
                .findFirst()
                .map(Element::getTextContent)
                .map(String::trim)
                .orElse("");
    }

    private Document fetchXml(URI uri) {
        try {
            HttpRequest request = HttpRequest.newBuilder(uri)
                    .timeout(Duration.ofSeconds(30))
                    .header("Accept", "application/xml,text/xml")
                    .GET()
                    .build();
            HttpResponse<byte[]> response = httpClient.send(request, HttpResponse.BodyHandlers.ofByteArray());

            if (response.statusCode() < 200 || response.statusCode() >= 300) {
                throw new IllegalStateException("HTTP " + response.statusCode());
            }

            return newDocumentBuilder().parse(new ByteArrayInputStream(response.body()));
        } catch (IOException ex) {
            throw new IllegalStateException("Cannot read XML from " + uri, ex);
        } catch (InterruptedException ex) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException("Interrupted while reading XML from " + uri, ex);
        } catch (SAXException ex) {
            throw new IllegalStateException("Invalid XML from " + uri, ex);
        }
    }

    private DocumentBuilder newDocumentBuilder() {
        try {
            DocumentBuilderFactory factory = DocumentBuilderFactory.newInstance();
            factory.setNamespaceAware(true);
            factory.setFeature(XMLConstants.FEATURE_SECURE_PROCESSING, true);
            factory.setFeature("http://apache.org/xml/features/disallow-doctype-decl", true);
            factory.setAttribute(XMLConstants.ACCESS_EXTERNAL_DTD, "");
            factory.setAttribute(XMLConstants.ACCESS_EXTERNAL_SCHEMA, "");
            return factory.newDocumentBuilder();
        } catch (ParserConfigurationException ex) {
            throw new IllegalStateException("Cannot configure XML parser", ex);
        }
    }

    private X509Certificate parseCertificate(String base64Certificate) {
        try {
            byte[] certificateBytes = Base64.getMimeDecoder().decode(base64Certificate);
            CertificateFactory certificateFactory = CertificateFactory.getInstance("X.509");
            return (X509Certificate) certificateFactory.generateCertificate(new ByteArrayInputStream(certificateBytes));
        } catch (IllegalArgumentException | CertificateException ex) {
            throw new IllegalStateException("Invalid X509Certificate element", ex);
        }
    }

    private List<String> certificateExtensionUris(X509Certificate certificate, String oid) {
        byte[] extensionValue = certificate.getExtensionValue(oid);
        if (extensionValue == null) {
            return List.of();
        }

        Set<String> urls = new LinkedHashSet<>();
        DerValue extension = DerValue.readOne(extensionValue);
        DerValue.readAll(extension.content()).forEach(value -> collectTaggedUris(value, urls));
        return List.copyOf(urls);
    }

    private List<String> extensionUriFallback(X509Certificate certificate, String oid, Predicate<String> predicate) {
        byte[] extensionValue = certificate.getExtensionValue(oid);
        if (extensionValue == null) {
            return List.of();
        }

        Set<String> urls = new LinkedHashSet<>();
        Matcher matcher = URI_PATTERN.matcher(new String(extensionValue, StandardCharsets.ISO_8859_1));
        while (matcher.find()) {
            String url = matcher.group();
            if (predicate.test(url)) {
                urls.add(url);
            }
        }

        return List.copyOf(urls);
    }

    private boolean looksLikeCrlUri(String uri) {
        String lowerCaseUri = uri.toLowerCase();
        return lowerCaseUri.contains(".crl") || lowerCaseUri.contains("/crl");
    }

    private boolean looksLikeOcspUri(String uri) {
        return uri.toLowerCase().contains("ocsp");
    }

    private List<String> merge(List<String> first, List<String> second) {
        Set<String> merged = new LinkedHashSet<>();
        merged.addAll(first);
        merged.addAll(second);
        return List.copyOf(merged);
    }

    private List<String> ocspUris(X509Certificate certificate) {
        byte[] extensionValue = certificate.getExtensionValue(AUTHORITY_INFORMATION_ACCESS_OID);
        if (extensionValue == null) {
            return List.of();
        }

        Set<String> urls = new LinkedHashSet<>();
        DerValue extension = DerValue.readOne(extensionValue);
        DerValue aiaSequence = DerValue.readOne(extension.content());

        for (DerValue accessDescription : DerValue.readAll(aiaSequence.content())) {
            if (accessDescription.tag() != 0x30) {
                continue;
            }

            List<DerValue> parts = DerValue.readAll(accessDescription.content());
            if (parts.size() < 2 || parts.getFirst().tag() != 0x06) {
                continue;
            }

            if (OCSP_ACCESS_METHOD_OID.equals(parts.getFirst().oid())) {
                collectTaggedUris(parts.get(1), urls);
            }
        }

        return List.copyOf(urls);
    }

    private void collectTaggedUris(DerValue value, Set<String> urls) {
        if (value.tag() == 0x86) {
            urls.add(new String(value.content(), StandardCharsets.US_ASCII));
        }

        if (value.isConstructed()) {
            DerValue.readAll(value.content()).forEach(child -> collectTaggedUris(child, urls));
        }
    }

    private List<Element> descendants(Element root, String localName) {
        List<Element> elements = new ArrayList<>();
        collectDescendants(root, localName, elements);
        return elements;
    }

    private List<Element> childElements(Element root, String localName) {
        List<Element> elements = new ArrayList<>();
        Node child = root.getFirstChild();
        while (child != null) {
            if (child instanceof Element element && localName.equals(element.getLocalName())) {
                elements.add(element);
            }
            child = child.getNextSibling();
        }
        return elements;
    }

    private void collectDescendants(Node node, String localName, List<Element> elements) {
        if (node instanceof Element element && localName.equals(element.getLocalName())) {
            elements.add(element);
        }

        Node child = node.getFirstChild();
        while (child != null) {
            collectDescendants(child, localName, elements);
            child = child.getNextSibling();
        }
    }

    private record DerValue(int tag, byte[] content) {

        boolean isConstructed() {
            return (tag & 0x20) == 0x20;
        }

        String oid() {
            if (tag != 0x06 || content.length == 0) {
                throw new IllegalStateException("DER value is not an OID");
            }

            List<Long> parts = new ArrayList<>();
            int first = Byte.toUnsignedInt(content[0]);
            parts.add((long) Math.min(first / 40, 2));
            parts.add((long) (first >= 80 ? first - 80 : first % 40));

            long value = 0;
            for (int i = 1; i < content.length; i++) {
                int current = Byte.toUnsignedInt(content[i]);
                value = (value << 7) | (current & 0x7f);
                if ((current & 0x80) == 0) {
                    parts.add(value);
                    value = 0;
                }
            }

            return String.join(".", parts.stream().map(String::valueOf).toList());
        }

        static DerValue readOne(byte[] bytes) {
            List<DerValue> values = readAll(bytes);
            if (values.size() != 1) {
                throw new IllegalStateException("Expected one DER value, got " + values.size());
            }
            return values.getFirst();
        }

        static List<DerValue> readAll(byte[] bytes) {
            List<DerValue> values = new ArrayList<>();
            int position = 0;

            while (position < bytes.length) {
                int tag = Byte.toUnsignedInt(bytes[position++]);
                Length length = readLength(bytes, position);
                position = length.nextPosition();
                int end = position + length.value();

                if (end > bytes.length) {
                    throw new IllegalStateException("DER length exceeds available bytes");
                }

                byte[] content = new byte[length.value()];
                System.arraycopy(bytes, position, content, 0, length.value());
                values.add(new DerValue(tag, content));
                position = end;
            }

            return values;
        }

        private static Length readLength(byte[] bytes, int position) {
            int first = Byte.toUnsignedInt(bytes[position++]);
            if ((first & 0x80) == 0) {
                return new Length(first, position);
            }

            int lengthBytes = first & 0x7f;
            if (lengthBytes == 0 || lengthBytes > 4) {
                throw new IllegalStateException("Unsupported DER length");
            }

            int length = 0;
            for (int i = 0; i < lengthBytes; i++) {
                length = (length << 8) | Byte.toUnsignedInt(bytes[position++]);
            }
            return new Length(length, position);
        }

        private record Length(int value, int nextPosition) {
        }
    }
}
