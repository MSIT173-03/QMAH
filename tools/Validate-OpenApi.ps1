[CmdletBinding()]
param(
    [Parameter()]
    [Uri]$OpenApiUrl = 'http://localhost:5147/openapi/v1.json',

    [Parameter()]
    [string]$ControllersPath = (Join-Path $PSScriptRoot '..\QMAH.Api\Controllers\V1'),

    [Parameter()]
    [string]$CatalogPath = (Join-Path $PSScriptRoot '..\QMAH.Api\Infrastructure\OpenApi\QmahOpenApiOperationCatalog.cs')
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Get-ControllerActions {
    $methodPattern = [regex]::new(
        '(?m)^\s*public\s+(?:async\s+)?(?:Task|ActionResult|IActionResult|IResult)\b[^\{;\r\n]*?\s+(?<Action>[A-Za-z_][A-Za-z0-9_]*)\s*\(')

    foreach ($file in Get-ChildItem -LiteralPath $ControllersPath -Filter '*Controller.cs' -File) {
        $controller = $file.BaseName -replace 'Controller$', ''
        $source = Get-Content -LiteralPath $file.FullName -Raw
        foreach ($match in $methodPattern.Matches($source)) {
            [pscustomobject]@{
                Key = "$controller.$($match.Groups['Action'].Value)"
                Controller = $controller
                Action = $match.Groups['Action'].Value
            }
        }
    }
}

function Get-AuthorizedActions {
    $methodPattern = [regex]::new(
        '(?ms)(?<Attributes>(?:^\s*\[[^\r\n]+\]\s*\r?\n)+)^\s*public\s+(?:async\s+)?(?:Task|ActionResult|IActionResult|IResult)\b[^\{;\r\n]*?\s+(?<Action>[A-Za-z_][A-Za-z0-9_]*)\s*\(')

    foreach ($file in Get-ChildItem -LiteralPath $ControllersPath -Filter '*Controller.cs' -File) {
        $controller = $file.BaseName -replace 'Controller$', ''
        $source = Get-Content -LiteralPath $file.FullName -Raw
        $className = $file.BaseName -replace '\.cs$', ''
        $classDeclaration = [regex]::Match(
            $source,
            '(?ms)(?<Header>.*?)public\s+sealed\s+class\s+' + [regex]::Escape($className) + '\b')
        $classRequiresAuthorization = $classDeclaration.Success -and $classDeclaration.Groups['Header'].Value -match '\[Authorize(?:\s*\([^\r\n]*\))?\]'

        foreach ($match in $methodPattern.Matches($source)) {
            $attributes = $match.Groups['Attributes'].Value
            $allowsAnonymous = $attributes -match '\[AllowAnonymous\]'
            $requiresAuthorization = !$allowsAnonymous -and (
                $classRequiresAuthorization -or
                $attributes -match '\[Authorize(?:\s*\([^\r\n]*\))?\]')
            if ($requiresAuthorization) {
                "$controller.$($match.Groups['Action'].Value)"
            }
        }
    }
}

function Get-OpenApiOperations {
    param([Parameter(Mandatory)]$Document)

    $verbs = @('get', 'post', 'put', 'patch', 'delete', 'head', 'options', 'trace')
    foreach ($pathProperty in $Document.paths.PSObject.Properties) {
        foreach ($verb in $verbs) {
            $verbProperty = $pathProperty.Value.PSObject.Properties[$verb]
            if ($null -eq $verbProperty) {
                continue
            }

            $operation = $verbProperty.Value
            [pscustomobject]@{
                Path = $pathProperty.Name
                Verb = $verb.ToUpperInvariant()
                OperationId = [string]$operation.operationId
                Summary = [string]$operation.summary
                Description = [string]$operation.description
                Operation = $operation
            }
        }
    }
}

function Assert-Condition {
    param(
        [Parameter(Mandatory)]
        [bool]$Condition,

        [Parameter(Mandatory)]
        [string]$Message
    )

    if (!$Condition) {
        throw "OpenAPI 契約驗證失敗：$Message"
    }
}

function Get-OpenApiPropertyValue {
    param(
        [Parameter(Mandatory = $false)]
        $Object,

        [Parameter(Mandatory)]
        [string]$Name
    )

    if ($null -eq $Object) {
        return $null
    }

    $property = $Object.PSObject.Properties[$Name]
    if ($null -eq $property) {
        return $null
    }

    return $property.Value
}

function Assert-ProblemResponse {
    param(
        [Parameter(Mandatory)]
        $Operation,

        [Parameter(Mandatory)]
        [string]$StatusCode
    )

    $response = Get-OpenApiPropertyValue $Operation.Operation.responses $StatusCode
    $content = Get-OpenApiPropertyValue $response 'content'
    $problemMedia = Get-OpenApiPropertyValue $content 'application/problem+json'
    Assert-Condition ($null -ne $problemMedia) "$($Operation.OperationId) 的 $StatusCode 缺少 application/problem+json"

    $schema = Get-OpenApiPropertyValue $problemMedia 'schema'
    $reference = [string](Get-OpenApiPropertyValue $schema '$ref')
    Assert-Condition ($reference -eq '#/components/schemas/ProblemDetails') "$($Operation.OperationId) 的 $StatusCode 未引用 ProblemDetails Schema"
}

function Assert-ExplainedTerms {
    param([Parameter(Mandatory)]$Operation)

    $text = "$($Operation.Summary) $($Operation.Description)"
    $termPatterns = [ordered]@{
        'request body' = 'request body`?\s*（'
        'path parameter' = 'path parameter`?\s*（'
        'query string' = 'query string`?\s*（'
        'response body' = 'response body`?\s*（'
        'Identity Cookie' = 'Identity Cookie`?\s*（'
        'Profile' = 'Profile`?\s*（'
        'ExternalRef' = 'ExternalRef`?\s*（'
        'multipart/form-data' = 'multipart/form-data`?\s*（'
        'binary' = 'binary`?\s*（'
        'altText' = 'altText`?\s*（'
        'GUID' = 'GUID`?\s*（'
        'code' = '(?<![A-Za-z])code`?\s*（'
    }

    foreach ($term in $termPatterns.Keys) {
        $termPresent = $text -match "(?i)(?<![A-Za-z])$([regex]::Escape($term))(?![A-Za-z])"
        $termExplained = $text -match "(?i)$($termPatterns[$term])"
        if ($termPresent -and !$termExplained)
        {
            throw "OpenAPI 契約驗證失敗：$($Operation.OperationId) 的 $term 缺少括號說明"
        }
    }
}

Write-Host "讀取 Controller：$ControllersPath"
$controllerActions = @(Get-ControllerActions)
$expectedKeys = @($controllerActions | ForEach-Object Key)
$expectedOperationIds = @($controllerActions | ForEach-Object { "$($_.Controller)_$($_.Action)" })
Assert-Condition ($expectedKeys.Count -gt 0) '找不到 Controller action'

$catalogSource = Get-Content -LiteralPath $CatalogPath -Raw
$catalogKeys = @(
    [regex]::Matches($catalogSource, '(?m)^\s*\["(?<Key>[^"]+)"\]\s*=') |
        ForEach-Object { $_.Groups['Key'].Value }
)
Assert-Condition ($catalogKeys.Count -eq ($catalogKeys | Select-Object -Unique).Count) 'catalog 含有重複 operation key'

$missingCatalog = @($expectedKeys | Where-Object { $_ -notin $catalogKeys })
$extraCatalog = @($catalogKeys | Where-Object { $_ -notin $expectedKeys })
Assert-Condition ($missingCatalog.Count -eq 0) "catalog 缺少：$($missingCatalog -join ', ')"
Assert-Condition ($extraCatalog.Count -eq 0) "catalog 多出：$($extraCatalog -join ', ')"

Write-Host "讀取 OpenAPI：$OpenApiUrl"
$document = Invoke-RestMethod -Uri $OpenApiUrl -Method Get
Assert-Condition ([string]$document.openapi -like '3.*') "OpenAPI 版本不符合 3.x：$($document.openapi)"
$operations = @(Get-OpenApiOperations -Document $document)
Assert-Condition ($operations.Count -eq $expectedKeys.Count) "Controller action $($expectedKeys.Count) 個，OpenAPI operation $($operations.Count) 個"

$operationIds = @($operations | ForEach-Object OperationId)
$duplicateOperationIds = @($operationIds | Group-Object | Where-Object Count -gt 1)
Assert-Condition ($duplicateOperationIds.Count -eq 0) "operationId 重複：$(@($duplicateOperationIds | ForEach-Object { $_.Name }) -join ', ')"
$missingOperationIds = @($expectedOperationIds | Where-Object { $_ -notin $operationIds })
Assert-Condition ($missingOperationIds.Count -eq 0) "OpenAPI 缺少 operationId：$($missingOperationIds -join ', ')"

$missingText = @(
    $operations | Where-Object {
        [string]::IsNullOrWhiteSpace($_.Summary) -or
        [string]::IsNullOrWhiteSpace($_.Description) -or
        $_.Summary.Length -gt 120 -or
        $_.Description -match '(?i)TODO|FIXME|TBD|your endpoint|這是一個 API'
    }
)
Assert-Condition ($missingText.Count -eq 0) '存在空白、過長或模板化的 summary／description'
Assert-Condition (@($operations | Where-Object { $_.Summary -match '[你您]' -or $_.Description -match '[你您]' }).Count -eq 0) 'summary／description 不得使用對話式稱謂'
$duplicateDescriptions = @($operations | Group-Object Description | Where-Object Count -gt 1)
Assert-Condition ($duplicateDescriptions.Count -eq 0) "存在重複的 operation description：$(@($duplicateDescriptions | ForEach-Object { $_.Group.OperationId -join ', ' }) -join '; ')"

$problemSchema = Get-OpenApiPropertyValue (Get-OpenApiPropertyValue $document 'components').schemas 'ProblemDetails'
Assert-Condition ($null -ne $problemSchema) 'components 缺少 ProblemDetails Schema'

$authorizedKeys = @(Get-AuthorizedActions)
foreach ($operation in $operations) {
    $responses = @($operation.Operation.responses.PSObject.Properties.Name)
    foreach ($responseProperty in @($operation.Operation.responses.PSObject.Properties)) {
        $responseDescription = [string](Get-OpenApiPropertyValue $responseProperty.Value 'description')
        Assert-Condition (!([string]::IsNullOrWhiteSpace($responseDescription))) "$($operation.OperationId) 的 $($responseProperty.Name) response 缺少說明"
    }
    Assert-Condition ($responses -contains '400') "$($operation.OperationId) 缺少 400 response"
    Assert-Condition ($responses -contains '500') "$($operation.OperationId) 缺少 500 response"
    Assert-ProblemResponse -Operation $operation -StatusCode '400'
    Assert-ProblemResponse -Operation $operation -StatusCode '500'

    $successResponses = @(@('200', '201', '202', '204') | Where-Object { $_ -in $responses })
    Assert-Condition ($successResponses.Count -gt 0) "$($operation.OperationId) 缺少成功 response"
    foreach ($successStatus in $successResponses) {
        $successResponse = Get-OpenApiPropertyValue $operation.Operation.responses $successStatus
        $successDescription = [string](Get-OpenApiPropertyValue $successResponse 'description')
        Assert-Condition (!([string]::IsNullOrWhiteSpace($successDescription)) -and $successDescription -ne 'OK') "$($operation.OperationId) 的 $successStatus 缺少具體成功說明"
    }

    foreach ($parameter in @(Get-OpenApiPropertyValue $operation.Operation 'parameters')) {
        if ($null -eq $parameter) {
            continue
        }

        $parameterDescription = [string](Get-OpenApiPropertyValue $parameter 'description')
        Assert-Condition (!([string]::IsNullOrWhiteSpace($parameterDescription))) "$($operation.OperationId) 的參數 $($parameter.name) 缺少說明"
    }

    $requestBody = Get-OpenApiPropertyValue $operation.Operation 'requestBody'
    if ($null -ne $requestBody) {
        $requestBodyDescription = [string](Get-OpenApiPropertyValue $requestBody 'description')
        Assert-Condition (!([string]::IsNullOrWhiteSpace($requestBodyDescription))) "$($operation.OperationId) 的 request body 缺少整體說明"
        $requestContent = Get-OpenApiPropertyValue $requestBody 'content'
        Assert-Condition ($null -ne $requestContent -and @($requestContent.PSObject.Properties).Count -gt 0) "$($operation.OperationId) 的 request body 缺少 media type"
        foreach ($mediaProperty in @($requestContent.PSObject.Properties)) {
            $mediaSchema = Get-OpenApiPropertyValue $mediaProperty.Value 'schema'
            $schemaProperties = Get-OpenApiPropertyValue $mediaSchema 'properties'
            if ($null -ne $schemaProperties) {
                foreach ($property in @($schemaProperties.PSObject.Properties)) {
                    $propertyDescription = [string](Get-OpenApiPropertyValue $property.Value 'description')
                    Assert-Condition (!([string]::IsNullOrWhiteSpace($propertyDescription))) "$($operation.OperationId) 的 request body 欄位 $($property.Name) 缺少說明"
                }
            }
        }
    }

    Assert-ExplainedTerms -Operation $operation

    $sourceKey = $operation.OperationId -replace '_', '.'
    if ($sourceKey -in $authorizedKeys) {
        Assert-Condition ($null -ne $operation.Operation.security -and @($operation.Operation.security).Count -gt 0) "$sourceKey 缺少 security metadata"
        Assert-Condition ($responses -contains '401') "$sourceKey 缺少 401 response"
        Assert-Condition ($responses -contains '403') "$sourceKey 缺少 403 response"
        Assert-ProblemResponse -Operation $operation -StatusCode '401'
        Assert-ProblemResponse -Operation $operation -StatusCode '403'
    }
    if ($operation.Path -match '\{[^}]+\}') {
        Assert-Condition ($responses -contains '404') "$sourceKey 缺少 404 response"
        Assert-ProblemResponse -Operation $operation -StatusCode '404'
    }
}

$upload = $operations | Where-Object OperationId -eq 'SocialMedia_Upload'
Assert-Condition ($null -ne $upload) '找不到社群圖片上傳 operation'
$multipart = $upload.Operation.requestBody.content.PSObject.Properties['multipart/form-data']
Assert-Condition ($null -ne $multipart) '圖片上傳缺少 multipart/form-data request body'
$uploadProperties = $multipart.Value.schema.properties.PSObject.Properties.Name
Assert-Condition ($uploadProperties -contains 'file' -and $uploadProperties -contains 'altText') '圖片上傳缺少 file 或 altText 欄位'
Assert-Condition ($multipart.Value.schema.properties.file.format -eq 'binary') '圖片上傳 file 欄位不是 binary format'
Assert-Condition (!([string]::IsNullOrWhiteSpace([string]$multipart.Value.schema.properties.file.description))) '圖片上傳 file 欄位缺少說明'
Assert-Condition (!([string]::IsNullOrWhiteSpace([string]$multipart.Value.schema.properties.altText.description))) '圖片上傳 altText 欄位缺少說明'
Assert-Condition (@($upload.Operation.responses.PSObject.Properties.Name) -contains '413') '圖片上傳缺少 413 response'
Assert-ProblemResponse -Operation $upload -StatusCode '413'

Write-Host "通過：$($expectedKeys.Count) 個 Controller action 與 catalog 一致"
Write-Host "通過：$($operations.Count) 個 OpenAPI operation 均有唯一 operationId"
Write-Host "通過：所有 operation 均有符合規範的 summary／description"
Write-Host '通過：成功回應、ProblemDetails 錯誤回應、參數與 request body 欄位均有契約說明'
Write-Host "通過：$($authorizedKeys.Count) 個需登入 operation 均有 Cookie security、401 與 403"
Write-Host '通過：圖片上傳使用 multipart/form-data、file binary、altText 與 413'
