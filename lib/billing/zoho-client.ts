type ZohoCreateSubscriptionInput = {
  zohoOrgId: string;
  customerEmail: string;
  planCode: string; // map from Product.zohoPlanId
};

type ZohoCreateSubscriptionResponse = {
  subscriptionId: string;
  customerId: string;
  hostedPageUrl: string;
};

export async function createZohoSubscription(
  input: ZohoCreateSubscriptionInput
): Promise<ZohoCreateSubscriptionResponse> {
  // 🔒 You will replace this with real Zoho API call
  // This is skeleton only

  if (!input.zohoOrgId) {
    throw new Error("zoho_org_missing");
  }

  if (!input.planCode) {
    throw new Error("zoho_plan_missing");
  }

  // Simulated response
  return {
    subscriptionId: "zoho_sub_mock_" + Date.now(),
    customerId: "zoho_customer_mock_" + Date.now(),
    hostedPageUrl: "https://billing.zoho.com/checkout/mock",
  };
}